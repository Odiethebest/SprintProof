import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import type { TeamRole } from "@/lib/auth/team-access";
import { POST as rotateWebhookSecret } from "@/app/api/v1/teams/[teamId]/webhook-secret/route";
import { GET as getTeam } from "@/app/api/v1/teams/[teamId]/route";
import { GET as listTeams, POST as createTeam } from "@/app/api/v1/teams/route";
import { POST as postWebhook } from "@/app/api/webhooks/github/route";
import pingPayload from "../../fixtures/github/ping.json";
import {
  insertApiToken,
  insertMembership,
  insertTeam,
  insertUser,
} from "../../factories/db";
import {
  apiGetRequest,
  apiRequest,
  bearer,
  routeContext,
  signWebhookPayload,
  webhookRequest,
} from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

// Decision 005 (#115): each team has its own webhook secret. Only the lead can
// rotate it, with a session, and no API response ever contains it.
vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));
vi.mock("@/server/realtime", () => ({ triggerTeamEvent: vi.fn() }));

const FORBIDDEN = {
  error: {
    code: "FORBIDDEN",
    message: "You don't have permission to do this on this team.",
  },
};

// What GitHub accepts as a secret, and what crypto.randomBytes(32) gives as hex.
const GENERATED_SECRET = /^[0-9a-f]{64}$/;

async function signInAs(teamId: string, role: TeamRole) {
  const user = await insertUser();
  await insertMembership({ userId: user.id, teamId, role });
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  return user;
}

function rotate(teamId: string, request?: Request) {
  return rotateWebhookSecret(
    request ?? apiRequest("POST", `/teams/${teamId}/webhook-secret`),
    routeContext({ teamId })
  );
}

async function storedSecret(teamId: string): Promise<string> {
  const team = await db.team.findUniqueOrThrow({ where: { id: teamId } });
  return team.webhookSecret;
}

function sendPing(input: { deliveryId: string; secret: string }) {
  const body = JSON.stringify(pingPayload);
  return postWebhook(
    webhookRequest({
      event: "ping",
      body,
      signature: signWebhookPayload(body, input.secret),
      deliveryId: input.deliveryId,
    })
  );
}

beforeEach(async () => {
  await clearDatabase();
  vi.mocked(getSessionUserId).mockReset();
});

describe("POST /api/v1/teams/{teamId}/webhook-secret", () => {
  it("replaces the team's secret with a new random one and returns only its last 4 characters", async () => {
    // Arrange
    const team = await insertTeam({ webhookSecret: "old-team-webhook-secret" });
    await signInAs(team.id, "LEAD");

    // Act
    const res = await rotate(team.id);

    // Assert
    expect(res.status).toBe(200);
    const text = await res.text();
    const secret = await storedSecret(team.id);
    expect(secret).toMatch(GENERATED_SECRET);
    expect(JSON.parse(text)).toEqual({ last4: secret.slice(-4) });
    expect(text).not.toContain(secret);
    expect(text).not.toContain("old-team-webhook-secret");
  });

  it("gives a new secret every time", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");
    await rotate(team.id);
    const first = await storedSecret(team.id);

    // Act
    await rotate(team.id);

    // Assert
    expect(await storedSecret(team.id)).not.toBe(first);
  });

  it("leaves other teams' secrets alone", async () => {
    // Arrange
    const team = await insertTeam();
    const otherTeam = await insertTeam({
      webhookSecret: "other-team-webhook-secret",
    });
    await signInAs(team.id, "LEAD");

    // Act
    await rotate(team.id);

    // Assert
    expect(await storedSecret(otherTeam.id)).toBe("other-team-webhook-secret");
  });

  it("rejects deliveries signed with the old secret once the lead rotates it", async () => {
    // Arrange: GitHub signs with the team's current secret
    const team = await insertTeam({
      repoFullName: "Odiethebest/SprintProof",
      webhookSecret: "old-team-webhook-secret",
    });
    await signInAs(team.id, "LEAD");
    expect(
      (
        await sendPing({
          deliveryId: "before",
          secret: "old-team-webhook-secret",
        })
      ).status
    ).toBe(200);

    // Act
    await rotate(team.id);

    // Assert: the old secret stops working and the new one works
    const oldSigned = await sendPing({
      deliveryId: "old-after-rotation",
      secret: "old-team-webhook-secret",
    });
    expect(oldSigned.status).toBe(401);
    const newSigned = await sendPing({
      deliveryId: "new-after-rotation",
      secret: await storedSecret(team.id),
    });
    expect(newSigned.status).toBe(200);
  });

  // Rotating doesn't decide which secret GitHub uses; only a delivery signed
  // with the team's own secret ends the fallback (decision 005).
  it("keeps accepting the server-wide secret after a rotation until GitHub signs with the team's own", async () => {
    // Arrange
    const team = await insertTeam({ canUseServerWebhookSecret: true });
    await signInAs(team.id, "LEAD");

    // Act
    await rotate(team.id);

    // Assert
    expect(
      await db.team.findUniqueOrThrow({ where: { id: team.id } })
    ).toMatchObject({ canUseServerWebhookSecret: true });
  });

  it.each<TeamRole>(["MEMBER", "INSTRUCTOR"])(
    "returns 403 to a %s and keeps the secret",
    async (role) => {
      // Arrange
      const team = await insertTeam({ webhookSecret: "team-webhook-secret" });
      await signInAs(team.id, role);

      // Act
      const res = await rotate(team.id);

      // Assert
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual(FORBIDDEN);
      expect(await storedSecret(team.id)).toBe("team-webhook-secret");
    }
  );

  it("returns 403 to a lead of another team", async () => {
    // Arrange
    const team = await insertTeam({ webhookSecret: "team-webhook-secret" });
    const otherTeam = await insertTeam();
    await signInAs(otherTeam.id, "LEAD");

    // Act
    const res = await rotate(team.id);

    // Assert
    expect(res.status).toBe(403);
    expect(await storedSecret(team.id)).toBe("team-webhook-secret");
  });

  it("returns 401 when signed out", async () => {
    // Arrange
    const team = await insertTeam({ webhookSecret: "team-webhook-secret" });
    vi.mocked(getSessionUserId).mockResolvedValue(null);

    // Act
    const res = await rotate(team.id);

    // Assert
    expect(res.status).toBe(401);
    expect(await storedSecret(team.id)).toBe("team-webhook-secret");
  });

  // API tokens only read (AGENTS.md §1 Key patterns).
  it("returns 401 for the lead's API token without a session", async () => {
    // Arrange
    const team = await insertTeam({ webhookSecret: "team-webhook-secret" });
    const lead = await signInAs(team.id, "LEAD");
    const { token } = await insertApiToken({ userId: lead.id });
    vi.mocked(getSessionUserId).mockResolvedValue(null);
    const request = new Request(
      `http://localhost:3000/api/v1/teams/${team.id}/webhook-secret`,
      { method: "POST", headers: { authorization: bearer(token) } }
    );

    // Act
    const res = await rotate(team.id, request);

    // Assert
    expect(res.status).toBe(401);
    expect(await storedSecret(team.id)).toBe("team-webhook-secret");
  });
});

describe("a team's webhook secret", () => {
  it("is generated when the team is created, different for every team", async () => {
    // Arrange
    const first = await insertUser();
    const second = await insertUser();

    // Act
    vi.mocked(getSessionUserId).mockResolvedValue(first.id);
    const firstRes = await createTeam(
      apiRequest("POST", "/teams", {
        name: "First",
        repoFullName: "Odiethebest/SprintProof",
      })
    );
    vi.mocked(getSessionUserId).mockResolvedValue(second.id);
    const secondRes = await createTeam(
      apiRequest("POST", "/teams", {
        name: "Second",
        repoFullName: "santiaojun/other-repo",
      })
    );

    // Assert
    const teams = await db.team.findMany({
      where: {
        id: { in: [(await firstRes.json()).id, (await secondRes.json()).id] },
      },
    });
    expect(teams).toHaveLength(2);
    for (const team of teams) {
      expect(team.webhookSecret).toMatch(GENERATED_SECRET);
      // A new team never accepts the server-wide secret (decision 005).
      expect(team.canUseServerWebhookSecret).toBe(false);
    }
    expect(teams[0].webhookSecret).not.toBe(teams[1].webhookSecret);
  });

  it("isn't in any team response, even the lead's", async () => {
    // Arrange
    const lead = await insertUser();
    vi.mocked(getSessionUserId).mockResolvedValue(lead.id);
    const created = await createTeam(
      apiRequest("POST", "/teams", {
        name: "SprintProof",
        repoFullName: "Odiethebest/SprintProof",
      })
    );
    const createdText = await created.text();
    const { id: teamId } = JSON.parse(createdText) as { id: string };
    const secret = await storedSecret(teamId);

    // Act
    const responses = [
      createdText,
      await (
        await getTeam(
          apiGetRequest(`/teams/${teamId}`),
          routeContext({ teamId })
        )
      ).text(),
      await (await listTeams(apiGetRequest("/teams"))).text(),
    ];

    // Assert
    for (const text of responses) {
      expect(text).not.toContain(secret);
      expect(text).not.toMatch(/webhookSecret/i);
    }
  });
});
