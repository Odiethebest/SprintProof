import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { POST } from "@/app/api/webhooks/github/route";
import pingPayload from "../../fixtures/github/ping.json";
import pushPayload from "../../fixtures/github/push.json";
import prOpenedPayload from "../../fixtures/github/pull-request-opened.json";
import prMergedPayload from "../../fixtures/github/pull-request-closed-merged.json";
import prUnmergedPayload from "../../fixtures/github/pull-request-closed-unmerged.json";
import prReviewPayload from "../../fixtures/github/pull-request-review.json";
import prReviewBotPayload from "../../fixtures/github/pull-request-review-bot.json";
import { insertMembership, insertTeam, insertUser } from "../../factories/db";
import { releaseActivityInsertsTogether } from "../helpers/activity-inserts";
import { signWebhookPayload, webhookRequest } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

// Integration tests mock external services at their wrappers (AGENTS.md §1 Testing).
// Live update events are covered in realtime-events.test.ts.
vi.mock("@/server/realtime", () => ({ triggerTeamEvent: vi.fn() }));

// Each team has its own webhook secret (decision 005, #115). Most tests use one
// team whose GitHub webhook signs with TEAM_SECRET. SERVER_SECRET is the
// server-wide GITHUB_WEBHOOK_SECRET, the fallback for teams connected before
// #115 and for repositories no team has connected.
const TEAM_SECRET = "test-webhook-secret-12345";
const SERVER_SECRET = "test-server-webhook-secret-67890";

function insertTeamWithSecret(
  overrides: Parameters<typeof insertTeam>[0] = {}
) {
  return insertTeam({ webhookSecret: TEAM_SECRET, ...overrides });
}

function sendSigned(input: {
  event: string;
  payload: unknown;
  deliveryId: string;
  secret?: string;
}) {
  const body = JSON.stringify(input.payload);
  return POST(
    webhookRequest({
      event: input.event,
      body,
      signature: signWebhookPayload(body, input.secret ?? TEAM_SECRET),
      deliveryId: input.deliveryId,
    })
  );
}

async function expectNothingStored() {
  expect(await db.webhookDelivery.count()).toBe(0);
  expect(await db.activity.count()).toBe(0);
}

// A push from alice with one commit per SHA, in the order given.
function pushWithShas(shas: string[]) {
  return {
    ...pushPayload,
    commits: shas.map((sha, index) => ({
      ...pushPayload.commits[0],
      id: sha,
      message: `Commit ${index + 1}`,
    })),
  };
}

describe("POST /api/webhooks/github", () => {
  beforeEach(async () => {
    await clearDatabase();
    process.env.GITHUB_WEBHOOK_SECRET = SERVER_SECRET;
  });

  describe("signature verification", () => {
    it("returns 401 when X-Hub-Signature-256 header is missing", async () => {
      const request = webhookRequest({
        event: "ping",
        body: pingPayload,
        // no signature
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toEqual({
        error: { code: "UNAUTHORIZED", message: expect.any(String) },
      });
    });

    it("returns 401 when signature does not match the payload", async () => {
      const payloadString = JSON.stringify(pingPayload);
      const wrongSignature = signWebhookPayload(payloadString, "wrong-secret");
      const request = webhookRequest({
        event: "ping",
        body: payloadString,
        signature: wrongSignature,
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toEqual({
        error: { code: "UNAUTHORIZED", message: expect.any(String) },
      });
    });

    // A body that isn't JSON names no repository, so only the server-wide
    // secret can verify it.
    it("returns 400 when the body is not JSON", async () => {
      const invalidBody = "{not-valid-json";
      const signature = signWebhookPayload(invalidBody, SERVER_SECRET);
      const request = webhookRequest({
        event: "push",
        body: invalidBody,
        signature,
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toEqual({
        error: { code: "VALIDATION_ERROR", message: expect.any(String) },
      });
    });
  });

  describe("configuration and required headers", () => {
    // Fail closed: with no server-wide secret, an empty HMAC key would let
    // anyone sign events. Before #115 this answered 500 for every delivery;
    // now each team's own secret still works, and the fallback simply isn't
    // there (decision 005).
    it.each([
      ["unset", undefined],
      ["empty", ""],
    ])(
      "returns 401 and stores nothing when GITHUB_WEBHOOK_SECRET is %s, even for a team that may still use it and a body signed with an empty key",
      async (_label, secret) => {
        // Arrange
        await insertTeamWithSecret({
          repoFullName: "Odiethebest/SprintProof",
          canUseServerWebhookSecret: true,
        });
        if (secret === undefined) {
          delete process.env.GITHUB_WEBHOOK_SECRET;
        } else {
          process.env.GITHUB_WEBHOOK_SECRET = secret;
        }
        const payloadString = JSON.stringify(pushPayload);
        const request = webhookRequest({
          event: "push",
          body: payloadString,
          signature: signWebhookPayload(payloadString, ""),
          deliveryId: "unconfigured-delivery",
        });

        // Act
        const response = await POST(request);

        // Assert
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({
          error: { code: "UNAUTHORIZED", message: expect.any(String) },
        });
        await expectNothingStored();
      }
    );

    it("stores a delivery signed with the team's own secret when GITHUB_WEBHOOK_SECRET isn't set", async () => {
      // Arrange
      const user = await insertUser({ githubLogin: "alice" });
      const team = await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
      });
      await insertMembership({
        userId: user.id,
        teamId: team.id,
        role: "MEMBER",
      });
      delete process.env.GITHUB_WEBHOOK_SECRET;

      // Act
      const response = await sendSigned({
        event: "push",
        payload: pushPayload,
        deliveryId: "no-server-secret-delivery",
      });

      // Assert
      expect(response.status).toBe(200);
      expect(await db.activity.count({ where: { teamId: team.id } })).toBe(2);
    });

    // Without a delivery id, every later header-less delivery would look like a duplicate.
    it("returns 400 and stores nothing when X-GitHub-Delivery is missing", async () => {
      // Arrange
      await insertTeamWithSecret({ repoFullName: "Odiethebest/SprintProof" });
      const payloadString = JSON.stringify(pushPayload);
      const request = webhookRequest({
        event: "push",
        body: payloadString,
        signature: signWebhookPayload(payloadString, TEAM_SECRET),
        deliveryId: null,
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: { code: "VALIDATION_ERROR", message: expect.any(String) },
      });
      await expectNothingStored();
    });

    it("returns 400 and stores nothing when X-GitHub-Event is missing", async () => {
      // Arrange
      await insertTeamWithSecret({ repoFullName: "Odiethebest/SprintProof" });
      const payloadString = JSON.stringify(pushPayload);
      const request = webhookRequest({
        event: null,
        body: payloadString,
        signature: signWebhookPayload(payloadString, TEAM_SECRET),
        deliveryId: "no-event-delivery",
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: { code: "VALIDATION_ERROR", message: expect.any(String) },
      });
      await expectNothingStored();
    });
  });

  describe("ping event", () => {
    it("returns 200 for ping event and stores repoId on the matching team as BigInt", async () => {
      const team = await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
        repoId: null,
      });

      const payloadString = JSON.stringify(pingPayload);
      const signature = signWebhookPayload(payloadString, TEAM_SECRET);
      const request = webhookRequest({
        event: "ping",
        body: payloadString,
        signature,
        deliveryId: "ping-delivery-1",
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify repoId was saved on the team as BigInt
      const updatedTeam = await db.team.findUniqueOrThrow({
        where: { id: team.id },
      });
      expect(updatedTeam.repoId).toBe(BigInt(987654321));

      // Verify delivery was recorded
      const delivery = await db.webhookDelivery.findUnique({
        where: { id: "ping-delivery-1" },
      });
      expect(delivery).toMatchObject({
        id: "ping-delivery-1",
        teamId: team.id,
        event: "ping",
      });
    });

    // No team has the repository, so only the server-wide secret can verify it.
    it("returns 200 for ping event even if repository is not yet connected", async () => {
      const payloadString = JSON.stringify(pingPayload);
      const signature = signWebhookPayload(payloadString, SERVER_SECRET);
      const request = webhookRequest({
        event: "ping",
        body: payloadString,
        signature,
        deliveryId: "ping-delivery-unconnected",
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe("push event", () => {
    it("stores commit activities and sets repoId on the team", async () => {
      const user = await insertUser({ githubLogin: "alice" });
      const team = await insertTeamWithSecret({
        repoFullName: "odiethebest/sprintproof", // test case-insensitive match
        repoId: null,
      });
      await insertMembership({
        userId: user.id,
        teamId: team.id,
        role: "MEMBER",
      });

      const payloadString = JSON.stringify(pushPayload);
      const signature = signWebhookPayload(payloadString, TEAM_SECRET);
      const request = webhookRequest({
        event: "push",
        body: payloadString,
        signature,
        deliveryId: "push-delivery-1",
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // repoId updated as BigInt
      const updatedTeam = await db.team.findUniqueOrThrow({
        where: { id: team.id },
      });
      expect(updatedTeam.repoId).toBe(BigInt(987654321));

      // Activities stored: alice (team member) and outsider (non-member) are stored; bot is ignored
      const activities = await db.activity.findMany({
        where: { teamId: team.id },
        orderBy: { occurredAt: "asc" },
      });

      expect(activities).toHaveLength(2);
      expect(activities[0]).toMatchObject({
        type: "COMMIT",
        actorLogin: "alice",
        sha: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
        title: "feat: add feature",
      });
      expect(activities[1]).toMatchObject({
        type: "COMMIT",
        actorLogin: "outsider",
        sha: "3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d",
        title: "fix: bugfix by outsider",
      });

      // No bot activity recorded
      const botActivities = await db.activity.findMany({
        where: { actorLogin: { contains: "[bot]" } },
      });
      expect(botActivities).toHaveLength(0);
    });

    // PostgreSQL text can't store NUL, and a redelivery carries the same
    // payload, so a 500 here meant the commit never counted (#90).
    it("stores a commit whose message contains NUL with the NUL removed", async () => {
      // Arrange
      const user = await insertUser({ githubLogin: "alice" });
      const team = await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
        repoId: 987654321n,
      });
      await insertMembership({
        userId: user.id,
        teamId: team.id,
        role: "MEMBER",
      });
      const commit = {
        ...pushPayload.commits[0],
        message: "feat: add\u0000 feature\n\nDetailed\u0000 explanation",
      };

      // Act
      const response = await sendSigned({
        event: "push",
        payload: { ...pushPayload, commits: [commit] },
        deliveryId: "nul-commit-delivery",
      });

      // Assert
      expect(response.status).toBe(200);
      const activities = await db.activity.findMany({
        where: { teamId: team.id },
      });
      expect(activities).toEqual([
        expect.objectContaining({
          type: "COMMIT",
          actorLogin: "alice",
          sha: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
          title: "feat: add feature",
          occurredAt: new Date("2026-11-05T15:30:00Z"),
        }),
      ]);
    });
  });

  describe("pull_request event", () => {
    it("stores PR_OPENED activity on action: opened", async () => {
      const user = await insertUser({ githubLogin: "alice" });
      const team = await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
        repoId: 987654321n,
      });
      await insertMembership({
        userId: user.id,
        teamId: team.id,
        role: "LEAD",
      });

      const payloadString = JSON.stringify(prOpenedPayload);
      const signature = signWebhookPayload(payloadString, TEAM_SECRET);
      const request = webhookRequest({
        event: "pull_request",
        body: payloadString,
        signature,
        deliveryId: "pr-open-delivery",
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const activity = await db.activity.findFirst({
        where: { teamId: team.id, type: "PR_OPENED" },
      });
      expect(activity).toMatchObject({
        type: "PR_OPENED",
        actorLogin: "alice",
        prNumber: 42,
        prAuthorLogin: "alice",
        title: "Add webhook receiver",
      });
    });

    it("stores PR_MERGED activity on action: closed with merged: true", async () => {
      const user = await insertUser({ githubLogin: "bob" });
      const team = await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
        repoId: 987654321n,
      });
      await insertMembership({
        userId: user.id,
        teamId: team.id,
        role: "MEMBER",
      });

      const payloadString = JSON.stringify(prMergedPayload);
      const signature = signWebhookPayload(payloadString, TEAM_SECRET);
      const request = webhookRequest({
        event: "pull_request",
        body: payloadString,
        signature,
        deliveryId: "pr-merge-delivery",
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const activity = await db.activity.findFirst({
        where: { teamId: team.id, type: "PR_MERGED" },
      });
      expect(activity).toMatchObject({
        type: "PR_MERGED",
        actorLogin: "bob",
        prNumber: 42,
        prAuthorLogin: "alice",
        title: "Add webhook receiver",
      });
    });

    it("does not store activity on action: closed when merged is false", async () => {
      const team = await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
        repoId: 987654321n,
      });

      const payloadString = JSON.stringify(prUnmergedPayload);
      const signature = signWebhookPayload(payloadString, TEAM_SECRET);
      const request = webhookRequest({
        event: "pull_request",
        body: payloadString,
        signature,
        deliveryId: "pr-unmerged-delivery",
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const activities = await db.activity.findMany({
        where: { teamId: team.id },
      });
      expect(activities).toHaveLength(0);
    });
  });

  describe("pull_request_review event", () => {
    it("stores REVIEW activity on action: submitted", async () => {
      const user = await insertUser({ githubLogin: "bob" });
      const team = await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
        repoId: 987654321n,
      });
      await insertMembership({
        userId: user.id,
        teamId: team.id,
        role: "MEMBER",
      });

      const payloadString = JSON.stringify(prReviewPayload);
      const signature = signWebhookPayload(payloadString, TEAM_SECRET);
      const request = webhookRequest({
        event: "pull_request_review",
        body: payloadString,
        signature,
        deliveryId: "pr-review-delivery",
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const activity = await db.activity.findFirst({
        where: { teamId: team.id, type: "REVIEW" },
      });
      expect(activity).toMatchObject({
        type: "REVIEW",
        actorLogin: "bob",
        prNumber: 42,
        prAuthorLogin: "alice",
        title: "Add webhook receiver",
        reviewState: "APPROVED",
      });
    });

    it.each([
      ["changes_requested", "CHANGES_REQUESTED"],
      ["commented", "COMMENTED"],
    ])(
      "stores a review submitted as %s with the state %s",
      async (state, reviewState) => {
        // Arrange
        const team = await insertTeamWithSecret({
          repoFullName: "Odiethebest/SprintProof",
          repoId: 987654321n,
        });
        const payload = {
          ...prReviewPayload,
          review: { ...prReviewPayload.review, state },
        };

        // Act
        const response = await sendSigned({
          event: "pull_request_review",
          payload,
          deliveryId: `review-${state}-delivery`,
        });

        // Assert
        expect(response.status).toBe(200);
        const activities = await db.activity.findMany({
          where: { teamId: team.id },
          select: { type: true, prNumber: true, reviewState: true },
        });
        expect(activities).toEqual([
          { type: "REVIEW", prNumber: 42, reviewState },
        ]);
      }
    );

    // Rejecting it would drop a review that counts under R3: a redelivery
    // carries the same state. It's stored with no state instead.
    it("stores a review submitted with a state GitHub doesn't document, with no state", async () => {
      // Arrange
      const team = await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
        repoId: 987654321n,
      });
      const payload = {
        ...prReviewPayload,
        review: { ...prReviewPayload.review, state: "escalated" },
      };

      // Act
      const response = await sendSigned({
        event: "pull_request_review",
        payload,
        deliveryId: "review-unknown-state-delivery",
      });

      // Assert
      expect(response.status).toBe(200);
      const activities = await db.activity.findMany({
        where: { teamId: team.id },
        select: { type: true, prNumber: true, reviewState: true },
      });
      expect(activities).toEqual([
        { type: "REVIEW", prNumber: 42, reviewState: null },
      ]);
    });

    it("stores a review on a PR whose title contains NUL with the NUL removed", async () => {
      // Arrange
      const user = await insertUser({ githubLogin: "bob" });
      const team = await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
        repoId: 987654321n,
      });
      await insertMembership({
        userId: user.id,
        teamId: team.id,
        role: "MEMBER",
      });
      const payload = {
        ...prReviewPayload,
        pull_request: {
          ...prReviewPayload.pull_request,
          title: "Add\u0000 webhook receiver",
        },
      };

      // Act
      const response = await sendSigned({
        event: "pull_request_review",
        payload,
        deliveryId: "nul-title-review-delivery",
      });

      // Assert
      expect(response.status).toBe(200);
      const activities = await db.activity.findMany({
        where: { teamId: team.id },
      });
      expect(activities).toEqual([
        expect.objectContaining({
          type: "REVIEW",
          actorLogin: "bob",
          prNumber: 42,
          prAuthorLogin: "alice",
          title: "Add webhook receiver",
        }),
      ]);
    });

    it("ignores reviews submitted by bots ending in [bot]", async () => {
      const team = await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
        repoId: 987654321n,
      });

      const payloadString = JSON.stringify(prReviewBotPayload);
      const signature = signWebhookPayload(payloadString, TEAM_SECRET);
      const request = webhookRequest({
        event: "pull_request_review",
        body: payloadString,
        signature,
        deliveryId: "pr-review-bot-delivery",
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const count = await db.activity.count({ where: { teamId: team.id } });
      expect(count).toBe(0);
    });
  });

  describe("repo rename and repoId lookup", () => {
    it("matches team by repoId even if repoFullName was renamed on GitHub", async () => {
      const team = await insertTeamWithSecret({
        repoFullName: "old-owner/old-repo-name",
        repoId: 987654321n,
      });

      // Payload has full_name "Odiethebest/SprintProof" but same repo id 987654321
      const payloadString = JSON.stringify(prOpenedPayload);
      const signature = signWebhookPayload(payloadString, TEAM_SECRET);
      const request = webhookRequest({
        event: "pull_request",
        body: payloadString,
        signature,
        deliveryId: "rename-delivery",
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const activity = await db.activity.findFirst({
        where: { teamId: team.id, prNumber: 42 },
      });
      expect(activity).not.toBeNull();
    });

    it("supports GitHub repository ids exceeding 2^31 - 1 (BigInt)", async () => {
      const largeRepoId = 1437673028n;
      const team = await insertTeamWithSecret({
        repoFullName: "large-owner/large-repo",
        repoId: largeRepoId,
      });

      const customPayload = {
        ...prOpenedPayload,
        repository: {
          id: 1437673028,
          full_name: "renamed-owner/large-repo",
        },
      };
      const payloadString = JSON.stringify(customPayload);
      const signature = signWebhookPayload(payloadString, TEAM_SECRET);
      const request = webhookRequest({
        event: "pull_request",
        body: payloadString,
        signature,
        deliveryId: "large-repoid-delivery",
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const activity = await db.activity.findFirst({
        where: { teamId: team.id, prNumber: 42 },
      });
      expect(activity).not.toBeNull();
    });
  });

  describe("idempotency and duplicate delivery handling", () => {
    it("stores duplicate deliveries (same X-GitHub-Delivery) only once", async () => {
      const team = await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
        repoId: 987654321n,
      });

      const payloadString = JSON.stringify(prOpenedPayload);
      const signature = signWebhookPayload(payloadString, TEAM_SECRET);
      const deliveryId = "exact-same-delivery-uuid";

      // First delivery
      const req1 = webhookRequest({
        event: "pull_request",
        body: payloadString,
        signature,
        deliveryId,
      });
      const res1 = await POST(req1);
      expect(res1.status).toBe(200);

      const countAfterFirst = await db.activity.count({
        where: { teamId: team.id },
      });
      expect(countAfterFirst).toBe(1);

      // Redelivery with same X-GitHub-Delivery
      const req2 = webhookRequest({
        event: "pull_request",
        body: payloadString,
        signature,
        deliveryId,
      });
      const res2 = await POST(req2);
      expect(res2.status).toBe(200);

      const countAfterSecond = await db.activity.count({
        where: { teamId: team.id },
      });
      expect(countAfterSecond).toBe(1);
    });

    // In payload order, each delivery could wait on a row the other had
    // inserted first; PostgreSQL aborted one as a deadlock, and it returned 500
    // until someone redelivered it by hand (#90).
    it("returns 200 for both of two concurrent deliveries with the same SHAs in opposite order, storing each commit once", async () => {
      // Arrange
      await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
        repoId: 987654321n,
      });
      const shas = Array.from({ length: 500 }, (_, index) =>
        index.toString(16).padStart(40, "0")
      );

      // Act
      const responses = await releaseActivityInsertsTogether({
        count: 2,
        run: () =>
          Promise.all([
            sendSigned({
              event: "push",
              payload: pushWithShas(shas),
              deliveryId: "ascending-shas",
            }),
            sendSigned({
              event: "push",
              payload: pushWithShas([...shas].reverse()),
              deliveryId: "descending-shas",
            }),
          ]),
      });

      // Assert
      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      const stored = await db.activity.findMany({ select: { sha: true } });
      expect(stored.map((row) => row.sha).sort()).toEqual(shas);
    }, 15000);
  });

  // Decision 005 (#115): the route finds the team from the payload's
  // repository, then verifies the signature with that team's secret.
  describe("each team's own secret", () => {
    it("returns 401 and stores nothing for a delivery signed with another team's secret", async () => {
      // Arrange: team B's lead signs a push that names team A's repository
      const author = await insertUser({ githubLogin: "alice" });
      const teamA = await insertTeam({
        repoFullName: "Odiethebest/SprintProof",
        repoId: null,
        webhookSecret: "team-a-webhook-secret",
      });
      await insertMembership({
        userId: author.id,
        teamId: teamA.id,
        role: "MEMBER",
      });
      await insertTeam({
        repoFullName: "santiaojun/other-repo",
        webhookSecret: "team-b-webhook-secret",
      });

      // Act
      const response = await sendSigned({
        event: "push",
        payload: pushPayload,
        deliveryId: "forged-delivery",
        secret: "team-b-webhook-secret",
      });

      // Assert: rejected before anything is stored, the repo id included
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: { code: "UNAUTHORIZED", message: expect.any(String) },
      });
      await expectNothingStored();
      const stored = await db.team.findUniqueOrThrow({
        where: { id: teamA.id },
      });
      expect(stored.repoId).toBeNull();
    });

    it("stores a delivery signed with the secret of the team that has the repository", async () => {
      // Arrange
      const author = await insertUser({ githubLogin: "alice" });
      const teamA = await insertTeam({
        repoFullName: "Odiethebest/SprintProof",
        webhookSecret: "team-a-webhook-secret",
      });
      await insertMembership({
        userId: author.id,
        teamId: teamA.id,
        role: "MEMBER",
      });
      const teamB = await insertTeam({
        repoFullName: "santiaojun/other-repo",
        webhookSecret: "team-b-webhook-secret",
      });

      // Act
      const response = await sendSigned({
        event: "push",
        payload: pushPayload,
        deliveryId: "team-a-delivery",
        secret: "team-a-webhook-secret",
      });

      // Assert
      expect(response.status).toBe(200);
      expect(await db.activity.count({ where: { teamId: teamA.id } })).toBe(2);
      expect(await db.activity.count({ where: { teamId: teamB.id } })).toBe(0);
    });

    it("returns 401 and stores nothing for a repository no team has, unless the server-wide secret signed it", async () => {
      // Arrange: the only team has another repository
      await insertTeamWithSecret({ repoFullName: "santiaojun/other-repo" });

      // Act
      const response = await sendSigned({
        event: "ping",
        payload: pingPayload,
        deliveryId: "unknown-repo-ping",
      });

      // Assert
      expect(response.status).toBe(401);
      await expectNothingStored();
    });

    it("rejects the server-wide secret for a team created after #115", async () => {
      // Arrange: new teams start without the fallback
      const user = await insertUser({ githubLogin: "alice" });
      const team = await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
      });
      await insertMembership({
        userId: user.id,
        teamId: team.id,
        role: "MEMBER",
      });

      // Act
      const response = await sendSigned({
        event: "push",
        payload: pushPayload,
        deliveryId: "server-secret-new-team",
        secret: SERVER_SECRET,
      });

      // Assert
      expect(response.status).toBe(401);
      await expectNothingStored();
    });

    it("accepts the server-wide secret for a team connected before #115 until GitHub signs a delivery with the team's own", async () => {
      // Arrange: the team's GitHub webhook still signs with the server-wide secret
      const user = await insertUser({ githubLogin: "alice" });
      const team = await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
        repoId: 987654321n,
        canUseServerWebhookSecret: true,
      });
      await insertMembership({
        userId: user.id,
        teamId: team.id,
        role: "MEMBER",
      });

      // Act: a push signed with the server-wide secret
      const before = await sendSigned({
        event: "push",
        payload: pushWithShas(["a".repeat(40)]),
        deliveryId: "server-secret-before",
        secret: SERVER_SECRET,
      });

      // Assert: stored, and the fallback stays on
      expect(before.status).toBe(200);
      expect(await db.activity.count({ where: { teamId: team.id } })).toBe(1);
      expect(
        await db.team.findUniqueOrThrow({ where: { id: team.id } })
      ).toMatchObject({ canUseServerWebhookSecret: true });

      // Act: the lead pastes the team's secret into GitHub, which pings
      const ping = await sendSigned({
        event: "ping",
        payload: pingPayload,
        deliveryId: "team-secret-ping",
      });

      // Assert: the fallback ends for this team
      expect(ping.status).toBe(200);
      expect(
        await db.team.findUniqueOrThrow({ where: { id: team.id } })
      ).toMatchObject({ canUseServerWebhookSecret: false });

      // Act: another push signed with the server-wide secret
      const after = await sendSigned({
        event: "push",
        payload: pushWithShas(["b".repeat(40)]),
        deliveryId: "server-secret-after",
        secret: SERVER_SECRET,
      });

      // Assert: rejected, and nothing more stored
      expect(after.status).toBe(401);
      expect(await db.activity.count({ where: { teamId: team.id } })).toBe(1);
      expect(
        await db.webhookDelivery.findUnique({
          where: { id: "server-secret-after" },
        })
      ).toBeNull();
    });

    it("keeps the fallback after a delivery with a wrong signature", async () => {
      // Arrange
      const team = await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
        canUseServerWebhookSecret: true,
      });

      // Act
      const response = await sendSigned({
        event: "ping",
        payload: pingPayload,
        deliveryId: "wrong-secret-ping",
        secret: "not-the-team-secret",
      });

      // Assert
      expect(response.status).toBe(401);
      expect(
        await db.team.findUniqueOrThrow({ where: { id: team.id } })
      ).toMatchObject({ canUseServerWebhookSecret: true });
    });
  });

  describe("unknown repository", () => {
    it("returns 404 when repository is not connected to any team", async () => {
      const payloadString = JSON.stringify(pushPayload);
      const signature = signWebhookPayload(payloadString, SERVER_SECRET);
      const request = webhookRequest({
        event: "push",
        body: payloadString,
        signature,
        deliveryId: "unknown-repo-delivery",
      });

      const response = await POST(request);
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json).toEqual({
        error: { code: "NOT_FOUND", message: expect.any(String) },
      });
    });
  });

  describe("payload validation and commit attribution", () => {
    it("returns 400 and stores nothing for a push whose commit has no timestamp", async () => {
      // Arrange
      await insertTeamWithSecret({ repoFullName: "Odiethebest/SprintProof" });
      const commit: Record<string, unknown> = { ...pushPayload.commits[0] };
      delete commit.timestamp;
      const payloadString = JSON.stringify({
        ...pushPayload,
        commits: [commit],
      });
      const request = webhookRequest({
        event: "push",
        body: payloadString,
        signature: signWebhookPayload(payloadString, TEAM_SECRET),
        deliveryId: "malformed-push-delivery",
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: "This push payload isn't in the format GitHub sends.",
        },
      });
      expect(await db.webhookDelivery.count()).toBe(0);
      expect(await db.activity.count()).toBe(0);
    });

    // Counting rule: commits are attributed by the author's GitHub login (AGENTS.md §1).
    it("doesn't credit the pusher with a commit whose author has no GitHub username", async () => {
      // Arrange: Odie pushes a commit Yunhong wrote with an email not linked to GitHub
      const pusher = await insertUser({ githubLogin: "Odiethebest" });
      const team = await insertTeamWithSecret({
        repoFullName: "Odiethebest/SprintProof",
      });
      await insertMembership({
        userId: pusher.id,
        teamId: team.id,
        role: "LEAD",
      });
      const payloadString = JSON.stringify({
        ...pushPayload,
        sender: { login: "Odiethebest" },
        pusher: { name: "Odiethebest" },
        commits: [
          {
            ...pushPayload.commits[0],
            author: { name: "Yunhong Huang", email: "unlinked@example.com" },
            committer: {
              name: "Odie Yang",
              email: "odie@example.com",
              username: "Odiethebest",
            },
          },
        ],
      });
      const request = webhookRequest({
        event: "push",
        body: payloadString,
        signature: signWebhookPayload(payloadString, TEAM_SECRET),
        deliveryId: "unlinked-author-delivery",
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(await db.activity.count({ where: { teamId: team.id } })).toBe(0);
    });
  });
});
