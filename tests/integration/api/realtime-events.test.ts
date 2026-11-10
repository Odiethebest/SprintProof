import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionUserId } from "@/server/auth-session";
import { triggerTeamEvent } from "@/server/realtime";
import type { TeamRole } from "@/lib/auth/team-access";
import { POST as postStandup } from "@/app/api/v1/teams/[teamId]/standups/route";
import { POST as postWebhook } from "@/app/api/webhooks/github/route";
import pingPayload from "../../fixtures/github/ping.json";
import pushPayload from "../../fixtures/github/push.json";
import prReviewBotPayload from "../../fixtures/github/pull-request-review-bot.json";
import {
  insertMembership,
  insertSprint,
  insertTeam,
  insertUser,
} from "../../factories/db";
import {
  apiRequest,
  routeContext,
  signWebhookPayload,
  webhookRequest,
} from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

// Integration tests mock external services at their wrappers (AGENTS.md §1 Testing).
vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));
vi.mock("@/server/realtime", () => ({ triggerTeamEvent: vi.fn() }));

const TEST_SECRET = "test-webhook-secret-12345";

const standupBody = {
  yesterday: "Wrote the dashboard tests.",
  today: "Wire up live updates.",
};

async function signInAs(teamId: string, role: TeamRole) {
  const user = await insertUser();
  await insertMembership({ userId: user.id, teamId, role });
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  return user;
}

function sendStandup(teamId: string, body: unknown) {
  return postStandup(
    apiRequest("POST", `/teams/${teamId}/standups`, body),
    routeContext({ teamId })
  );
}

function sendWebhook(input: {
  event: string;
  payload: unknown;
  deliveryId: string;
}) {
  const body = JSON.stringify(input.payload);
  return postWebhook(
    webhookRequest({
      event: input.event,
      body,
      signature: signWebhookPayload(body, TEST_SECRET),
      deliveryId: input.deliveryId,
    })
  );
}

describe("real-time events", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
    vi.mocked(triggerTeamEvent).mockReset();
    vi.mocked(triggerTeamEvent).mockResolvedValue(undefined);
  });

  describe("POST /api/v1/teams/{teamId}/standups", () => {
    beforeEach(() => {
      // Only Date is faked, so the database driver's timers keep running.
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-02T17:05:00Z")); // Nov 2, 9:05 AM PST
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function teamWithCurrentSprint() {
      const team = await insertTeam();
      await insertSprint({
        teamId: team.id,
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });
      return team;
    }

    it("triggers standup.created on the team's channel when a standup is posted", async () => {
      // Arrange
      const team = await teamWithCurrentSprint();
      await signInAs(team.id, "MEMBER");

      // Act
      const response = await sendStandup(team.id, standupBody);

      // Assert
      expect(response.status).toBe(201);
      expect(triggerTeamEvent).toHaveBeenCalledExactlyOnceWith({
        teamId: team.id,
        event: "standup.created",
      });
    });

    it("triggers standup.updated when the same day's standup is saved again", async () => {
      // Arrange
      const team = await teamWithCurrentSprint();
      await signInAs(team.id, "LEAD");
      await sendStandup(team.id, standupBody);
      vi.mocked(triggerTeamEvent).mockClear();

      // Act
      const response = await sendStandup(team.id, {
        ...standupBody,
        today: "Write the E2E test.",
      });

      // Assert
      expect(response.status).toBe(200);
      expect(triggerTeamEvent).toHaveBeenCalledExactlyOnceWith({
        teamId: team.id,
        event: "standup.updated",
      });
    });

    it("doesn't trigger an event when the standup is invalid", async () => {
      const team = await teamWithCurrentSprint();
      await signInAs(team.id, "MEMBER");

      const response = await sendStandup(team.id, { today: "No yesterday." });

      expect(response.status).toBe(400);
      expect(triggerTeamEvent).not.toHaveBeenCalled();
    });

    it("doesn't trigger an event when today isn't in a sprint", async () => {
      const team = await insertTeam();
      await signInAs(team.id, "MEMBER");

      const response = await sendStandup(team.id, standupBody);

      expect(response.status).toBe(409);
      expect(triggerTeamEvent).not.toHaveBeenCalled();
    });

    it("doesn't trigger an event when the user can't post", async () => {
      const team = await teamWithCurrentSprint();
      await signInAs(team.id, "INSTRUCTOR");

      const response = await sendStandup(team.id, standupBody);

      expect(response.status).toBe(403);
      expect(triggerTeamEvent).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/webhooks/github", () => {
    beforeEach(() => {
      vi.stubEnv("GITHUB_WEBHOOK_SECRET", TEST_SECRET);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    async function connectedTeam() {
      return insertTeam({
        repoFullName: "Odiethebest/SprintProof",
        repoId: 987654321n,
      });
    }

    it("triggers activity.created once after storing a delivery's activities", async () => {
      // Arrange
      const team = await connectedTeam();

      // Act
      const response = await sendWebhook({
        event: "push",
        payload: pushPayload,
        deliveryId: "push-delivery-1",
      });

      // Assert: one event per delivery, however many commits it carried
      expect(response.status).toBe(200);
      expect(triggerTeamEvent).toHaveBeenCalledExactlyOnceWith({
        teamId: team.id,
        event: "activity.created",
      });
    });

    it("doesn't trigger again when GitHub redelivers the same delivery", async () => {
      // Arrange
      await connectedTeam();
      await sendWebhook({
        event: "push",
        payload: pushPayload,
        deliveryId: "push-delivery-1",
      });
      vi.mocked(triggerTeamEvent).mockClear();

      // Act
      const response = await sendWebhook({
        event: "push",
        payload: pushPayload,
        deliveryId: "push-delivery-1",
      });

      // Assert
      expect(response.status).toBe(200);
      expect(triggerTeamEvent).not.toHaveBeenCalled();
    });

    it("doesn't trigger for a new delivery containing only existing commits", async () => {
      await connectedTeam();
      await sendWebhook({
        event: "push",
        payload: pushPayload,
        deliveryId: "original",
      });
      vi.mocked(triggerTeamEvent).mockClear();
      const response = await sendWebhook({
        event: "push",
        payload: pushPayload,
        deliveryId: "duplicate-shas",
      });
      expect(response.status).toBe(200);
      expect(triggerTeamEvent).not.toHaveBeenCalled();
    });

    it("returns 500 when storing an activity fails so GitHub can retry", async () => {
      await connectedTeam();
      const payload = structuredClone(pushPayload);
      payload.commits[0].message = "bad\u0000text";
      const response = await sendWebhook({
        event: "push",
        payload,
        deliveryId: "failed-write",
      });
      expect(response.status).toBe(500);
      expect(triggerTeamEvent).not.toHaveBeenCalled();
    });

    it("logs which delivery failed without logging its payload", async () => {
      await connectedTeam();
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const payload = structuredClone(pushPayload);
      payload.commits[0].message = "private-commit-message\u0000";
      await sendWebhook({ event: "push", payload, deliveryId: "logged-write" });
      expect(log).toHaveBeenCalledTimes(1);
      const line = log.mock.calls[0].map(String).join(" ");
      expect(line).toContain("logged-write");
      expect(line).not.toContain("private-commit-message");
      log.mockRestore();
    });

    it("doesn't trigger an event for a ping", async () => {
      await connectedTeam();

      const response = await sendWebhook({
        event: "ping",
        payload: pingPayload,
        deliveryId: "ping-delivery-1",
      });

      expect(response.status).toBe(200);
      expect(triggerTeamEvent).not.toHaveBeenCalled();
    });

    it("doesn't trigger an event when a delivery stores no activity", async () => {
      // A bot's review is ignored, so nothing on the dashboard changes
      await connectedTeam();

      const response = await sendWebhook({
        event: "pull_request_review",
        payload: prReviewBotPayload,
        deliveryId: "bot-review-delivery-1",
      });

      expect(response.status).toBe(200);
      expect(triggerTeamEvent).not.toHaveBeenCalled();
    });

    it("doesn't trigger an event for a repository that isn't connected", async () => {
      const response = await sendWebhook({
        event: "push",
        payload: pushPayload,
        deliveryId: "push-delivery-unknown",
      });

      expect(response.status).toBe(404);
      expect(triggerTeamEvent).not.toHaveBeenCalled();
    });
  });
});
