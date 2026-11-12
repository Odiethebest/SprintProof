import { errorResponse } from "@/server/api-response";
import {
  findSigningTeamId,
  matchWebhookSecret,
} from "@/lib/github/webhook-signature";
import {
  extractWebhookRepository,
  mapWebhookToActivities,
  type WebhookRepository,
} from "@/lib/github/webhook-events";
import {
  findPendingTeamsByRepo,
  findTeamByRepo,
  recordTeamRepoId,
  stopServerWebhookSecret,
  verifyTeamRepo,
} from "@/server/repositories/teams";
import { recordWebhookEvent } from "@/server/repositories/activities";
import { triggerTeamEvent } from "@/server/realtime";
import { describeDatabaseError } from "@/server/prisma-errors";

export async function POST(request: Request): Promise<Response> {
  try {
    return await handleWebhook(request);
  } catch (error) {
    // GitHub doesn't redeliver a failed delivery on its own. The 500 marks it
    // failed in the webhook's Recent Deliveries, where a lead can redeliver it
    // (https://docs.github.com/webhooks/using-webhooks/handling-failed-webhook-deliveries).
    // The log says which delivery failed and why, without the payload
    // (AGENTS.md §4 Security requirements).
    console.error(
      `Couldn't store webhook delivery ${request.headers.get("x-github-delivery") ?? "(no id)"}:`,
      describeDatabaseError(error)
    );
    return errorResponse({
      status: 500,
      code: "WEBHOOK_STORAGE_FAILED",
      message:
        "Couldn't store this delivery. Redeliver it from the webhook's Recent Deliveries on GitHub.",
    });
  }
}

// The body as JSON, or null when it isn't JSON. Nothing in it is trusted until
// the signature check passes.
function parseJson(rawBody: string): { payload: unknown } | null {
  try {
    return { payload: JSON.parse(rawBody) };
  } catch {
    return null;
  }
}

async function handleWebhook(request: Request): Promise<Response> {
  const rawBody = await request.text();
  // Decision 005 (#115): the payload names the repository, the repository
  // gives the team, and the team's secret verifies the signature. Reading the
  // repository first means parsing an unverified body once; nothing is stored
  // or trusted before the check below.
  const parsed = parseJson(rawBody);
  const repo =
    parsed === null
      ? null
      : extractWebhookRepository({ payload: parsed.payload });
  // Decision 007 (#117): the team verified for the repository, if any, and
  // the teams that have it pending.
  const [team, pendingTeams] =
    repo === null
      ? [null, []]
      : await Promise.all([
          findTeamByRepo({
            repoId: BigInt(repo.id),
            repoFullName: repo.fullName,
          }),
          findPendingTeamsByRepo({ repoFullName: repo.fullName }),
        ]);
  const signatureHeader = request.headers.get("x-hub-signature-256");
  const signer = matchWebhookSecret({
    rawBody,
    signatureHeader,
    team,
    // Only the transition fallback now (decision 005). Unset or empty, it
    // verifies nothing, and it never verifies a pending team: every lead
    // from before #115 has it, so it can't show who added the webhook.
    serverSecret: process.env.GITHUB_WEBHOOK_SECRET ?? null,
  });
  const pendingTeamId =
    signer === null
      ? findSigningTeamId({ rawBody, signatureHeader, teams: pendingTeams })
      : null;
  if (signer === null && pendingTeamId === null) {
    return errorResponse({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid webhook signature.",
    });
  }
  if (
    team !== null &&
    signer === "TEAM_SECRET" &&
    team.canUseServerWebhookSecret
  ) {
    // GitHub now signs with the team's own secret, so the transition is over
    // for this team (decision 005).
    await stopServerWebhookSecret({ teamId: team.id });
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

  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Send the request body as JSON.",
    });
  }
  const { payload } = parsed;

  // A pending team's own secret signed it, so the repository is in the
  // payload: only such teams are looked up by it.
  if (pendingTeamId !== null && repo !== null) {
    return handlePendingTeamDelivery({
      event,
      deliveryId,
      repo,
      teamId: pendingTeamId,
      hasVerifiedTeam: team !== null,
    });
  }

  if (event === "ping") {
    if (team !== null && repo !== null) {
      await recordTeamRepoId({ teamId: team.id, repoId: BigInt(repo.id) });
    }
    await recordWebhookEvent({
      teamId: team?.id ?? null,
      event: "ping",
      deliveryId,
      activities: [],
    });
    return Response.json({ ok: true }, { status: 200 });
  }

  // Validate before storing the team's repo id on first contact.
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

  if (team === null) {
    return errorResponse({
      status: 404,
      code: "NOT_FOUND",
      message: "No team found connected to this repository.",
    });
  }

  await recordTeamRepoId({ teamId: team.id, repoId: BigInt(repo.id) });
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

// Decision 007 (#117): a delivery signed with the secret of a team that has
// the repository pending. Its ping verifies the team, unless another team is
// verified already; nothing else it sends is stored. The responses show up in
// the webhook's Recent Deliveries on GitHub, so they say what to do.
async function handlePendingTeamDelivery({
  event,
  deliveryId,
  repo,
  teamId,
  hasVerifiedTeam,
}: {
  event: string;
  deliveryId: string;
  repo: WebhookRepository;
  teamId: string;
  hasVerifiedTeam: boolean;
}): Promise<Response> {
  if (hasVerifiedTeam) {
    return repoAlreadyConnectedResponse();
  }
  if (event !== "ping") {
    return errorResponse({
      status: 404,
      code: "NOT_FOUND",
      message:
        "This repository isn't connected yet. Redeliver GitHub's ping from the webhook's Recent Deliveries.",
    });
  }
  const isVerified = await verifyTeamRepo({
    teamId,
    repoId: BigInt(repo.id),
    repoFullName: repo.fullName,
  });
  if (!isVerified) {
    return repoAlreadyConnectedResponse();
  }
  await recordWebhookEvent({
    teamId,
    event: "ping",
    deliveryId,
    activities: [],
  });
  return Response.json({ ok: true }, { status: 200 });
}

function repoAlreadyConnectedResponse(): Response {
  return errorResponse({
    status: 409,
    code: "REPO_ALREADY_CONNECTED",
    message: "Another team already connected this repo.",
  });
}
