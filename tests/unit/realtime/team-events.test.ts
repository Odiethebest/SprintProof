import { describe, expect, it } from "vitest";
import { TEAM_EVENTS, getTeamChannel } from "@/lib/realtime/team-events";

describe("getTeamChannel", () => {
  it("names a team's channel team-{teamId}", () => {
    // Real-time flow: one channel per team (AGENTS.md §1 Key patterns)
    expect(getTeamChannel({ teamId: "cmw76wdgp0002t98wl4jud04b" })).toBe(
      "team-cmw76wdgp0002t98wl4jud04b"
    );
  });
});

describe("TEAM_EVENTS", () => {
  it("lists the events a team channel carries", () => {
    expect(TEAM_EVENTS).toEqual([
      "standup.created",
      "standup.updated",
      "activity.created",
    ]);
  });
});
