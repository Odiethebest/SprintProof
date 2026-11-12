import { beforeEach, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import { POST as createSprint } from "@/app/api/v1/teams/[teamId]/sprints/route";
import { PATCH as editSprint } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/route";
import { POST as createTeam } from "@/app/api/v1/teams/route";
import { createInvite } from "@/server/repositories/invites";
import { findTeamByRepo } from "@/server/repositories/teams";
import {
  insertUser,
  insertTeam,
  insertMembership,
  insertSprint,
} from "../../factories/db";
import {
  createTeamInput,
  createSprintInput,
} from "../../factories/validation-inputs";
import {
  claimRepoPastTheLock,
  runWhileInviteWriteHoldsItsLock,
} from "../helpers/lock-races";
import { apiRequest, routeContext } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";
vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));
beforeEach(clearDatabase);
async function lead(teamOverrides: { id?: string } = {}) {
  const user = await insertUser();
  const team = await insertTeam(teamOverrides);
  await insertMembership({ userId: user.id, teamId: team.id, role: "LEAD" });
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  return team;
}
function post(teamId: string, startDate: string, endDate: string) {
  return createSprint(
    apiRequest("POST", "/", createSprintInput({ startDate, endDate })),
    routeContext({ teamId })
  );
}
function patch(teamId: string, sprintId: string, body: unknown) {
  return editSprint(
    apiRequest("PATCH", "/", body),
    routeContext({ teamId, sprintId })
  );
}
// Every pair of the team's stored sprints whose dates overlap, as date ranges.
async function overlappingSprints(teamId: string) {
  const rows = await db.sprint.findMany({
    where: { teamId },
    orderBy: { startDate: "asc" },
    select: { startDate: true, endDate: true },
  });
  const ranges = rows.map((row) => ({
    start: row.startDate.toISOString().slice(0, 10),
    end: row.endDate.toISOString().slice(0, 10),
  }));
  return ranges.flatMap((range, index) =>
    ranges
      .slice(index + 1)
      .filter((other) => other.start <= range.end && range.start <= other.end)
      .map((other) => [range, other])
  );
}
it("serializes two concurrent overlapping sprint creates", async () => {
  const team = await lead();
  const results = await Promise.all([
    post(team.id, "2026-11-01", "2026-11-07"),
    post(team.id, "2026-11-05", "2026-11-10"),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([201, 400]);
  expect(await db.sprint.count()).toBe(1);
});
it("serializes a sprint create racing an overlapping edit", async () => {
  const team = await lead();
  const sprint = await insertSprint({
    teamId: team.id,
    startDate: "2026-11-01",
    endDate: "2026-11-03",
  });
  const results = await Promise.all([
    post(team.id, "2026-11-05", "2026-11-10"),
    patch(team.id, sprint.id, { endDate: "2026-11-07" }),
  ]);
  expect(await overlappingSprints(team.id)).toEqual([]);
  expect(results.filter((result) => result.status === 400)).toHaveLength(1);
});
it("serializes edits of two sprints into the same gap", async () => {
  const team = await lead();
  const first = await insertSprint({
    teamId: team.id,
    startDate: "2026-11-01",
    endDate: "2026-11-03",
  });
  const last = await insertSprint({
    teamId: team.id,
    startDate: "2026-11-10",
    endDate: "2026-11-12",
  });
  const results = await Promise.all([
    patch(team.id, first.id, { endDate: "2026-11-07" }),
    patch(team.id, last.id, { startDate: "2026-11-05" }),
  ]);
  expect(await overlappingSprints(team.id)).toEqual([]);
  expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
});
it("keeps both independent fields when concurrent partial edits update one sprint", async () => {
  const team = await lead();
  const sprint = await insertSprint({ teamId: team.id });
  const results = await Promise.all([
    patch(team.id, sprint.id, { name: "Renamed" }),
    patch(team.id, sprint.id, { reviewsPerPerson: 9 }),
  ]);
  expect(results.map((result) => result.status)).toEqual([200, 200]);
  expect(
    await db.sprint.findUnique({ where: { id: sprint.id } })
  ).toMatchObject({ name: "Renamed", reviewsPerPerson: 9 });
});
it("leaves one active invite per role after concurrent creates", async () => {
  const team = await lead();
  const now = new Date("2026-11-09T12:00:00Z");
  for (const role of ["MEMBER", "INSTRUCTOR"] as const) {
    await Promise.all([
      createInvite({ teamId: team.id, role, now }),
      createInvite({ teamId: team.id, role, now }),
    ]);
    expect(
      await db.invite.count({
        where: {
          teamId: team.id,
          role,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      })
    ).toBe(1);
  }
});
// With the one-number lock keys from #75, `invites:team-49546` and
// `sprints:team-41474` had the same hashtext(), so these unrelated writes of
// two teams waited for each other.
it("doesn't make a sprint write wait for an invite write whose old lock key hashes the same", async () => {
  const [{ isSameHash }] = await db.$queryRaw<{ isSameHash: boolean }[]>`
    SELECT hashtext('invites:team-49546') = hashtext('sprints:team-41474')
      AS "isSameHash"`;
  expect(isSameHash).toBe(true);
  const inviteTeam = await insertTeam({ id: "team-49546" });
  const sprintTeam = await lead({ id: "team-41474" });
  const { hasFinishedWhileHeld, result } =
    await runWhileInviteWriteHoldsItsLock({
      teamId: inviteTeam.id,
      run: () => post(sprintTeam.id, "2026-11-01", "2026-11-07"),
    });
  expect(hasFinishedWhileHeld).toBe(true);
  expect(result.status).toBe(201);
});
it("serializes case-insensitive repository claims", async () => {
  const user = await insertUser();
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  const responses = await Promise.all(
    ["Org/Repo", "org/repo"].map((repoFullName) =>
      createTeam(apiRequest("POST", "/", createTeamInput({ repoFullName })))
    )
  );
  expect(responses.map((result) => result.status).sort()).toEqual([201, 409]);
  expect(await db.team.count()).toBe(1);
});
it("keeps repository names unique across letter case in the database itself", async () => {
  await insertTeam({ repoFullName: "Org/Repo" });
  await expect(insertTeam({ repoFullName: "org/repo" })).rejects.toMatchObject({
    code: "P2002",
  });
});
it("returns 409 when a claim in another letter case gets past the lock", async () => {
  const user = await insertUser();
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  const response = await claimRepoPastTheLock({
    repoFullName: "org/repo",
    run: () =>
      createTeam(
        apiRequest("POST", "/", createTeamInput({ repoFullName: "Org/Repo" }))
      ),
  });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: { code: "REPO_ALREADY_CONNECTED", message: expect.any(String) },
  });
  expect(await db.team.findMany({ select: { repoFullName: true } })).toEqual([
    { repoFullName: "org/repo" },
  ]);
  expect(await db.membership.count()).toBe(0);
});
it("rejects a reused name belonging to another non-null repo id", async () => {
  const team = await insertTeam({ repoFullName: "Org/Repo", repoId: 123n });
  expect(
    await findTeamByRepo({ repoFullName: "org/repo", repoId: 456n })
  ).toBeNull();
  expect(
    await findTeamByRepo({ repoFullName: "Org/Renamed", repoId: 123n })
  ).toMatchObject({ id: team.id });
});
