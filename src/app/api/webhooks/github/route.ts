import { errorResponse } from "@/server/api-response";
import { verifyWebhookSignature } from "@/lib/github/webhook-signature";
import {
  extractWebhookRepository,
  mapWebhookToActivities,
} from "@/lib/github/webhook-events";
import { findTeamByRepo } from "@/server/repositories/teams";
import { recordWebhookEvent } from "@/server/repositories/activities";

export async function POST(request: Request): Promise<Response> {
  const signatureHeader = request.headers.get("x-hub-signature-256");
  const rawBody = await request.text();
  const secret = process.env.GITHUB_WEBHOOK_SECRET ?? "";

  if (!verifyWebhookSignature({ rawBody, signatureHeader, secret })) {
    return errorResponse({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid webhook signature.",
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

  const event = request.headers.get("x-github-event") ?? "";
  const deliveryId = request.headers.get("x-github-delivery") ?? "";

  const repo = extractWebhookRepository({ payload });

  if (event === "ping") {
    let teamId: string | null = null;
    if (repo !== null) {
      const team = await findTeamByRepo({
        repoId: BigInt(repo.id),
        repoFullName: repo.fullName,
      });
      teamId = team?.id ?? null;
    }

    if (deliveryId) {
      await recordWebhookEvent({
        teamId,
        event: "ping",
        deliveryId,
        activities: [],
      });
    }

    return Response.json({ ok: true }, { status: 200 });
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

  const activities = mapWebhookToActivities({ event, payload });

  const result = await recordWebhookEvent({
    teamId: team.id,
    event,
    deliveryId,
    activities,
  });

  if (!result.alreadyProcessed && activities.length > 0) {
    // TODO(#12): trigger Pusher event on team-${team.id} channel (activity.created)
  }

  return Response.json({ ok: true }, { status: 200 });
}
