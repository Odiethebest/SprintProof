import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import { triggerTeamEvent } from "@/server/realtime";
import { POST as createTeamRoute } from "@/app/api/v1/teams/route";
import { POST as webhookRoute } from "@/app/api/webhooks/github/route";
import pingPayload from "../../fixtures/github/ping.json";
import pushPayload from "../../fixtures/github/push.json";
import { insertMembership, insertTeam, insertUser } from "../../factories/db";
import { createTeamInput } from "../../factories/validation-inputs";
import {
  apiRequest,
  signWebhookPayload,
  webhookRequest,
} from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

// Decision 007 (#117): a team's repository is pending until GitHub delivers a
// `ping` signed with that team's own webhook secret. That ping verifies the
// team and stores the repository id. Pending claims don't block anyone; once
// a team is verified, nobody else can claim the repository, and only the
// verified team's deliveries count.

vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));
vi.mock("@/server/realtime", () => ({ triggerTeamEvent: vi.fn() }));

// The server-wide GITHUB_WEBHOOK_SECRET, the transition fallback (decision 005).
const SERVER_SECRET = "test-server-webhook-secret-117";
const REPO = { id: 987654321, fullName: "Odiethebest/SprintProof" };

async function createTeamAsNewUser(repoFullName: string) {
  const user = await insertUser();
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  return createTeamRoute(
    apiRequest("POST", "/teams", createTeamInput({ repoFullName }))
  );
}

// A team created through the API, the way a lead does: pending, with a random
// secret of its own.
async function createPendingTeam(repoFullName: string) {
  const response = await createTeamAsNewUser(repoFullName);
  expect(response.status).toBe(201);
  const { id } = (await response.json()) as { id: string };
  return db.team.findUniqueOrThrow({ where: { id } });
}

function deliver(input: {
  event: string;
  payload: unknown;
  deliveryId: string;
  secret: string;
}) {
  const body = JSON.stringify(input.payload);
  return webhookRoute(
    webhookRequest({
      event: input.event,
      body,
      signature: signWebhookPayload(body, input.secret),
      deliveryId: input.deliveryId,
    })
  );
}

// GitHub's ping for REPO, as it sends one when a webhook is added.
function ping(input: { secret: string; deliveryId: string }) {
  return deliver({ event: "ping", payload: pingPayload, ...input });
}

// A push to REPO with commits by alice and an outsider, both stored, and one
// by a bot, never stored.
function push(input: { secret: string; deliveryId: string }) {
  return deliver({
    event: "push",
    payload: pushPayload,
    deliveryId: input.deliveryId,
    secret: input.secret,
  });
}

async function teamState(teamId: string) {
  return db.team.findUniqueOrThrow({
    where: { id: teamId },
    select: { repoVerifiedAt: true, repoId: true },
  });
}

async function addMember(teamId: string, githubLogin: string) {
  const user = await insertUser({ githubLogin });
  await insertMembership({ userId: user.id, teamId, role: "MEMBER" });
}

beforeEach(async () => {
  await clearDatabase();
  vi.mocked(getSessionUserId).mockReset();
  vi.mocked(triggerTeamEvent).mockReset();
  process.env.GITHUB_WEBHOOK_SECRET = SERVER_SECRET;
});

describe("creating a team for a repository", () => {
  it("leaves the new team's repository pending, with no repository id", async () => {
    // Act
    const team = await createPendingTeam(REPO.fullName);

    // Assert
    expect(await teamState(team.id)).toEqual({
      repoVerifiedAt: null,
      repoId: null,
    });
  });

  it.each([
    ["the same letter case", "Odiethebest/SprintProof"],
    ["another letter case", "odiethebest/sprintproof"],
  ])(
    "lets a second team claim a repository another team has pending, in %s",
    async (_label, secondName) => {
      // Arrange
      await createPendingTeam(REPO.fullName);

      // Act
      const response = await createTeamAsNewUser(secondName);

      // Assert
      expect(response.status).toBe(201);
      expect(await db.team.count()).toBe(2);
    }
  );

  it.each([
    ["the same letter case", "Odiethebest/SprintProof"],
    ["another letter case", "ODIETHEBEST/sprintproof"],
  ])(
    "returns 409 REPO_ALREADY_CONNECTED once another team is verified for the repository, in %s",
    async (_label, name) => {
      // Arrange
      await insertTeam({
        repoFullName: REPO.fullName,
        repoId: BigInt(REPO.id),
        repoVerifiedAt: new Date("2026-11-10T12:00:00Z"),
      });

      // Act
      const response = await createTeamAsNewUser(name);

      // Assert
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: { code: "REPO_ALREADY_CONNECTED", message: expect.any(String) },
      });
      expect(await db.team.count()).toBe(1);
    }
  );
});

describe("GitHub's ping", () => {
  it("verifies the team whose secret signed it, among two teams with the repository pending, and stores the repository id", async () => {
    // Arrange: team A claimed the repository first, team B is the real one
    const teamA = await createPendingTeam(REPO.fullName);
    const teamB = await createPendingTeam("odiethebest/sprintproof");

    // Act: B's lead adds the webhook with B's secret, and GitHub pings
    const response = await ping({
      secret: teamB.webhookSecret,
      deliveryId: "ping-team-b",
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await teamState(teamB.id)).toEqual({
      repoVerifiedAt: expect.any(Date),
      repoId: BigInt(REPO.id),
    });
    expect(await teamState(teamA.id)).toEqual({
      repoVerifiedAt: null,
      repoId: null,
    });
    expect(
      await db.webhookDelivery.findUniqueOrThrow({
        where: { id: "ping-team-b" },
      })
    ).toMatchObject({ teamId: teamB.id, event: "ping" });
  });

  it("ends the server-wide secret fallback for the team it verifies", async () => {
    // Arrange: a team from before #115 that never received a delivery
    const team = await insertTeam({
      repoFullName: REPO.fullName,
      repoVerifiedAt: null,
      canUseServerWebhookSecret: true,
    });

    // Act
    const response = await ping({
      secret: team.webhookSecret,
      deliveryId: "ping-old-team",
    });

    // Assert
    expect(response.status).toBe(200);
    expect(
      await db.team.findUniqueOrThrow({ where: { id: team.id } })
    ).toMatchObject({
      repoVerifiedAt: expect.any(Date),
      canUseServerWebhookSecret: false,
    });
  });

  it("keeps the first verification when GitHub pings the verified team again", async () => {
    // Arrange
    const team = await createPendingTeam(REPO.fullName);
    await ping({ secret: team.webhookSecret, deliveryId: "first-ping" });
    const { repoVerifiedAt } = await teamState(team.id);

    // Act
    const response = await ping({
      secret: team.webhookSecret,
      deliveryId: "second-ping",
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await teamState(team.id)).toEqual({
      repoVerifiedAt,
      repoId: BigInt(REPO.id),
    });
  });

  it("returns 409 REPO_ALREADY_CONNECTED for a pending team's ping once another team is verified, and leaves it pending", async () => {
    // Arrange
    const teamA = await createPendingTeam(REPO.fullName);
    const teamB = await createPendingTeam(REPO.fullName);
    await ping({ secret: teamB.webhookSecret, deliveryId: "ping-team-b" });

    // Act
    const response = await ping({
      secret: teamA.webhookSecret,
      deliveryId: "ping-team-a",
    });

    // Assert
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "REPO_ALREADY_CONNECTED", message: expect.any(String) },
    });
    expect(await teamState(teamA.id)).toEqual({
      repoVerifiedAt: null,
      repoId: null,
    });
    expect(
      await db.webhookDelivery.findUnique({ where: { id: "ping-team-a" } })
    ).toBeNull();
  });

  // GitHub keeps a repository's id across renames (#11).
  it("returns 409 for a pending team's ping when the verified team has the repository under its old name", async () => {
    // Arrange: the verified team connected the repository before its rename
    await insertTeam({
      repoFullName: "Odiethebest/OldName",
      repoId: BigInt(REPO.id),
    });
    const pending = await createPendingTeam(REPO.fullName);

    // Act
    const response = await ping({
      secret: pending.webhookSecret,
      deliveryId: "ping-after-rename",
    });

    // Assert
    expect(response.status).toBe(409);
    expect(await teamState(pending.id)).toEqual({
      repoVerifiedAt: null,
      repoId: null,
    });
  });

  it("verifies exactly one team when two pending teams' pings arrive at the same time", async () => {
    // Arrange
    const teamA = await createPendingTeam(REPO.fullName);
    const teamB = await createPendingTeam("odiethebest/SPRINTPROOF");

    // Act
    const responses = await Promise.all([
      ping({ secret: teamA.webhookSecret, deliveryId: "ping-a" }),
      ping({ secret: teamB.webhookSecret, deliveryId: "ping-b" }),
    ]);

    // Assert
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      await db.team.count({ where: { repoVerifiedAt: { not: null } } })
    ).toBe(1);
  });

  // The server-wide secret is shared by every lead who set up a webhook
  // before #115, so it can't prove which team set this one up.
  it("never verifies a pending team when the server-wide secret signed the ping, and keeps the ping without a team", async () => {
    // Arrange: even a team from before #115, which may use that secret
    const team = await insertTeam({
      repoFullName: REPO.fullName,
      repoVerifiedAt: null,
      canUseServerWebhookSecret: true,
    });

    // Act
    const response = await ping({
      secret: SERVER_SECRET,
      deliveryId: "server-secret-ping",
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await teamState(team.id)).toEqual({
      repoVerifiedAt: null,
      repoId: null,
    });
    expect(
      await db.webhookDelivery.findUniqueOrThrow({
        where: { id: "server-secret-ping" },
      })
    ).toMatchObject({ teamId: null, event: "ping" });
  });

  it("returns 401 for a ping signed with a secret no team with the repository has", async () => {
    // Arrange
    await createPendingTeam(REPO.fullName);
    const other = await createPendingTeam("santiaojun/other-repo");

    // Act
    const response = await ping({
      secret: other.webhookSecret,
      deliveryId: "ping-wrong-team",
    });

    // Assert
    expect(response.status).toBe(401);
    expect(await db.team.count({ where: { repoVerifiedAt: null } })).toBe(2);
    expect(await db.webhookDelivery.count()).toBe(0);
  });
});

describe("deliveries other than ping", () => {
  it("stores the verified team's activity, and not the other team's, once the ping verified team B", async () => {
    // Arrange: alice is on both teams; team B is verified
    const teamA = await createPendingTeam(REPO.fullName);
    const teamB = await createPendingTeam(REPO.fullName);
    const alice = await insertUser({ githubLogin: "alice" });
    for (const teamId of [teamA.id, teamB.id]) {
      await insertMembership({ userId: alice.id, teamId, role: "MEMBER" });
    }
    await ping({ secret: teamB.webhookSecret, deliveryId: "ping-team-b" });

    // Act: a push signed with A's secret, then the same push with B's
    const fromA = await push({
      secret: teamA.webhookSecret,
      deliveryId: "push-team-a",
    });
    const fromB = await push({
      secret: teamB.webhookSecret,
      deliveryId: "push-team-b",
    });

    // Assert: A's isn't stored at all; B's counts for B
    expect(fromA.status).toBe(409);
    expect(await fromA.json()).toEqual({
      error: { code: "REPO_ALREADY_CONNECTED", message: expect.any(String) },
    });
    expect(fromB.status).toBe(200);
    expect(await db.activity.count({ where: { teamId: teamA.id } })).toBe(0);
    expect(await db.activity.count({ where: { teamId: teamB.id } })).toBe(2);
    expect(
      await db.webhookDelivery.findUnique({ where: { id: "push-team-a" } })
    ).toBeNull();
    expect(vi.mocked(triggerTeamEvent)).not.toHaveBeenCalledWith(
      expect.objectContaining({ teamId: teamA.id })
    );
  });

  it("returns 404 and stores nothing for a push signed with a pending team's secret before any ping", async () => {
    // Arrange
    const team = await createPendingTeam(REPO.fullName);
    await addMember(team.id, "alice");

    // Act
    const response = await push({
      secret: team.webhookSecret,
      deliveryId: "push-before-ping",
    });

    // Assert: GitHub's Recent Deliveries shows why
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "NOT_FOUND", message: expect.stringContaining("ping") },
    });
    expect(await db.activity.count()).toBe(0);
    expect(await db.webhookDelivery.count()).toBe(0);
    expect(await teamState(team.id)).toEqual({
      repoVerifiedAt: null,
      repoId: null,
    });
  });

  it("returns 404 and stores nothing for a push signed with the server-wide secret when the repository has only pending teams", async () => {
    // Arrange: a team from before #115 that may still use the server-wide secret
    const team = await insertTeam({
      repoFullName: REPO.fullName,
      repoVerifiedAt: null,
      canUseServerWebhookSecret: true,
    });
    await addMember(team.id, "alice");

    // Act
    const response = await push({
      secret: SERVER_SECRET,
      deliveryId: "server-secret-push",
    });

    // Assert
    expect(response.status).toBe(404);
    expect(await db.activity.count()).toBe(0);
    expect(await db.webhookDelivery.count()).toBe(0);
  });

  it("keeps the server-wide secret working for a verified team from before #115", async () => {
    // Arrange
    const team = await insertTeam({
      repoFullName: REPO.fullName,
      repoId: BigInt(REPO.id),
      canUseServerWebhookSecret: true,
    });
    await addMember(team.id, "alice");

    // Act
    const response = await push({
      secret: SERVER_SECRET,
      deliveryId: "server-secret-verified-push",
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await db.activity.count({ where: { teamId: team.id } })).toBe(2);
  });
});

describe("the database", () => {
  it.each([
    ["the same letter case", "Odiethebest/SprintProof"],
    ["another letter case", "odiethebest/sprintproof"],
  ])(
    "rejects a second verified team for one repository, in %s",
    async (_label, secondName) => {
      // Arrange
      await insertTeam({ repoFullName: REPO.fullName });

      // Act and assert
      await expect(
        insertTeam({ repoFullName: secondName })
      ).rejects.toMatchObject({ code: "P2002" });
    }
  );

  it("rejects verifying a pending team when another team is verified for the repository in another letter case", async () => {
    // Arrange
    await insertTeam({ repoFullName: REPO.fullName });
    const pending = await insertTeam({
      repoFullName: "odiethebest/sprintproof",
      repoVerifiedAt: null,
    });

    // Act and assert
    await expect(
      db.team.update({
        where: { id: pending.id },
        data: { repoVerifiedAt: new Date() },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("keeps any number of pending teams next to a verified one", async () => {
    // Act
    await insertTeam({ repoFullName: REPO.fullName });
    await insertTeam({ repoFullName: REPO.fullName, repoVerifiedAt: null });
    await insertTeam({ repoFullName: REPO.fullName, repoVerifiedAt: null });
    await insertTeam({
      repoFullName: "ODIETHEBEST/SPRINTPROOF",
      repoVerifiedAt: null,
    });

    // Assert
    expect(await db.team.count()).toBe(4);
  });
});

// Repository names are compared ignoring case, and nothing else: "_" (which
// GitHub allows in names) and "%" match only themselves, never other
// characters.
describe("repository names with _ or %", () => {
  it("lets a team claim owner/a_b while another team is verified for owner/aXb", async () => {
    // Arrange
    await insertTeam({ repoFullName: "owner/aXb", repoId: 1n });

    // Act
    const response = await createTeamAsNewUser("owner/a_b");

    // Assert
    expect(response.status).toBe(201);
  });

  it("verifies a pending team for owner/a_b while another team is verified for owner/aXb", async () => {
    // Arrange
    await insertTeam({ repoFullName: "owner/aXb", repoId: 1n });
    const pending = await createPendingTeam("owner/a_b");

    // Act
    const response = await deliver({
      event: "ping",
      payload: {
        ...pingPayload,
        repository: { id: 2, name: "a_b", full_name: "owner/a_b" },
      },
      deliveryId: "ping-underscore",
      secret: pending.webhookSecret,
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await teamState(pending.id)).toEqual({
      repoVerifiedAt: expect.any(Date),
      repoId: 2n,
    });
  });

  // The payload isn't trusted until a team's secret verifies it, and even
  // then it can only verify that team for the repository it claimed.
  it("returns 401 for a ping naming %/% signed with a pending team's secret, and verifies nothing", async () => {
    // Arrange
    const pending = await createPendingTeam("owner/claimed");

    // Act
    const response = await deliver({
      event: "ping",
      payload: {
        ...pingPayload,
        repository: { id: 3, name: "%", full_name: "%/%" },
      },
      deliveryId: "ping-percent",
      secret: pending.webhookSecret,
    });

    // Assert
    expect(response.status).toBe(401);
    expect(await teamState(pending.id)).toEqual({
      repoVerifiedAt: null,
      repoId: null,
    });
  });

  it("returns 401 for a push naming owner/a_b signed with the secret of the team verified for owner/aXb", async () => {
    // Arrange: with no repository id stored, only the name finds the team
    const verified = await insertTeam({
      repoFullName: "owner/aXb",
      repoId: null,
    });
    await insertMembership({
      userId: (await insertUser({ githubLogin: "alice" })).id,
      teamId: verified.id,
      role: "MEMBER",
    });

    // Act
    const response = await deliver({
      event: "push",
      payload: {
        ...pushPayload,
        repository: {
          ...pushPayload.repository,
          id: 2,
          full_name: "owner/a_b",
        },
      },
      deliveryId: "push-underscore",
      secret: verified.webhookSecret,
    });

    // Assert
    expect(response.status).toBe(401);
    expect(await db.activity.count()).toBe(0);
  });
});
