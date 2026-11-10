import { errorResponse } from "@/server/api-response";
import { verifyWebhookSignature } from "@/lib/github/webhook-signature";
import {
  extractWebhookRepository,
  mapWebhookToActivities,
} from "@/lib/github/webhook-events";
import { findTeamByRepo } from "@/server/repositories/teams";
import { recordWebhookEvent } from "@/server/repositories/activities";
import { triggerTeamEvent } from "@/server/realtime";
import { describeDatabaseError } from "@/server/prisma-errors";

export async function POST(request: Request): Promise<Response> {
  try {
    return await handleWebhook(request);
  } catch (error) {
    // The 500 makes GitHub retry; the log says which delivery failed and why,
    // without the payload (AGENTS.md §4 Security requirements).
    console.error(
      `Couldn't store webhook delivery ${request.headers.get("x-github-delivery") ?? "(no id)"}:`,
      describeDatabaseError(error)
    );
    return errorResponse({
      status: 500,
      code: "WEBHOOK_STORAGE_FAILED",
      message: "Couldn't store this delivery. Please retry.",
    });
  }
}

async function handleWebhook(request: Request): Promise<Response> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  // Fail closed: without a secret, no signature can prove the sender is GitHub.
  if (!secret) {
    return errorResponse({
      status: 500,
      code: "WEBHOOK_NOT_CONFIGURED",
      message: "GitHub webhooks aren't set up on this server yet.",
    });
  }

  const signatureHeader = request.headers.get("x-hub-signature-256");
  const rawBody = await request.text();
  if (!verifyWebhookSignature({ rawBody, signatureHeader, secret })) {
    return errorResponse({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid webhook signature.",
    });
  }

  const event = request.headers.get("x-github-event");
  const deliveryId = request.headers.get("x-github-delivery");
  // Deduplication keys on the delivery id, so a delivery without one can't be stored safely.
  if (!event || !deliveryId) {
    return errorResponse({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Send the X-GitHub-Event and X-GitHub-Delivery headers.",
    });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return errorResponse({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Send the request body as JSON.",
    });
  }

  const repo = extractWebhookRepository({ payload });

  if (event === "ping") {
    const team =
      repo === null
        ? null
        : await findTeamByRepo({
            repoId: BigInt(repo.id),
            repoFullName: repo.fullName,
          });
    await recordWebhookEvent({
      teamId: team?.id ?? null,
      event: "ping",
      deliveryId,
      activities: [],
    });
    return Response.json({ ok: true }, { status: 200 });
  }

  // Validate before the team lookup, which stores the repo id on first contact.
  const mapping = mapWebhookToActivities({ event, payload });
  if (!mapping.isValid) {
    return errorResponse({
      status: 400,
      code: "VALIDATION_ERROR",
      message: mapping.message,
    });
  }

  if (repo === null) {
    return errorResponse({
      status: 404,
      code: "NOT_FOUND",
      message: "Repository information missing in webhook payload.",
    });
  }

  const team = await findTeamByRepo({
    repoId: BigInt(repo.id),
    repoFullName: repo.fullName,
  });

  if (team === null) {
    return errorResponse({
      status: 404,
      code: "NOT_FOUND",
      message: "No team found connected to this repository.",
    });
  }

  const result = await recordWebhookEvent({
    teamId: team.id,
    event,
    deliveryId,
    activities: mapping.activities,
  });

  // One event per delivery, however many commits it carried. A redelivery or
  // a delivery with nothing stored (a bot's review) changes nothing on screen.
  if (result.activitiesCreated > 0) {
    await triggerTeamEvent({ teamId: team.id, event: "activity.created" });
  }

  return Response.json({ ok: true }, { status: 200 });
}
