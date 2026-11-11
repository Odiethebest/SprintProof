import { beforeEach, describe, expect, it } from "vitest";
import {
  buildSprintSummaryMarkdown,
  getExportAudience,
} from "@/lib/export/sprint-summary-markdown";
import {
  createMemberSummary,
  createSprintSummary,
  createStandupEntry,
  resetMemberSummarySeq,
  resetStandupSeq,
} from "../../factories";

const team = {
  name: "SprintProof",
  repoFullName: "Odiethebest/SprintProof",
  timezone: "America/Los_Angeles",
};

const ZIQI = {
  userId: "user-ziqi",
  name: "Ziqi (Odie) Yang",
  githubLogin: "Odiethebest",
  role: "LEAD" as const,
};
const YUNHONG = {
  userId: "user-yunhong",
  name: "Yunhong Huang",
  githubLogin: "santiaojun",
  role: "MEMBER" as const,
};

// The lines of the document between a heading and the next heading.
function section(markdown: string, heading: string): string[] {
  const lines = markdown.split("\n");
  const start = lines.indexOf(heading);
  if (start === -1) {
    throw new Error(`No "${heading}" heading`);
  }
  const level = heading.split(" ")[0];
  const end = lines.findIndex(
    (line, index) =>
      index > start &&
      line.startsWith("#") &&
      line.split(" ")[0].length <= level.length
  );
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

describe("buildSprintSummaryMarkdown", () => {
  beforeEach(() => {
    resetMemberSummarySeq();
    resetStandupSeq();
  });

  it("writes the sprint, the requirements table and standups by person in the docs/sprints style", () => {
    // Arrange
    const summary = createSprintSummary({
      members: [
        createMemberSummary({
          ...ZIQI,
          commits: 19,
          pullRequests: 5,
          standups: { count: 3, required: 3, remaining: 0, status: "MET" },
          reviews: { count: 2, required: 5, remaining: 3, status: "AT_RISK" },
        }),
        createMemberSummary({
          ...YUNHONG,
          commits: 15,
          pullRequests: 5,
          standups: { count: 2, required: 3, remaining: 1, status: "AT_RISK" },
          reviews: { count: 5, required: 5, remaining: 0, status: "MET" },
        }),
      ],
    });
    const standups = [
      createStandupEntry({
        userId: ZIQI.userId,
        date: "2026-10-29",
        yesterday: "Planned Sprint 1 with Yunhong.",
        today: "Finish the PRD (#1) and open the PR.",
        blockers: null,
      }),
      createStandupEntry({
        userId: YUNHONG.userId,
        date: "2026-11-01",
        yesterday: "CI pipeline with Vercel previews is up for review (#4).",
        today: "Sprint planning with requirements (#8).",
        blockers: "Waiting on reviews for #107 and #108.",
      }),
      createStandupEntry({
        userId: ZIQI.userId,
        date: "2026-11-02",
        yesterday: "GitHub sign-in works on preview deploys (#6).",
        today: "Team creation and invite links (#7).",
        blockers: null,
      }),
    ];

    // Act
    const markdown = buildSprintSummaryMarkdown({
      team,
      summary,
      standups,
      audience: "TEAM",
    });

    // Assert
    expect(markdown).toBe(
      [
        "# Sprint 1 summary",
        "",
        "**Team:** SprintProof (Odiethebest/SprintProof) · **Timezone:** America/Los_Angeles",
        "**Dates:** 2026-10-29 – 2026-11-04 · 2 days left · **Counts as of:** 2026-11-03",
        "**Requirements:** 3 standups and 5 PR reviews per person",
        "",
        "## Requirements",
        "| Member | GitHub | Standups | PR reviews | Commits | PRs |",
        "| --- | --- | --- | --- | --- | --- |",
        "| Ziqi (Odie) Yang | @Odiethebest | 3 / 3 · Met | 2 / 5 · At risk | 19 | 5 |",
        "| Yunhong Huang | @santiaojun | 2 / 3 · At risk | 5 / 5 · Met | 15 | 5 |",
        "",
        "## Standups",
        "",
        "### Ziqi (Odie) Yang",
        "",
        "#### 2026-11-02",
        "**Yesterday:** GitHub sign-in works on preview deploys (#6).",
        "**Today:** Team creation and invite links (#7).",
        "**Blockers:** None.",
        "",
        "#### 2026-10-29",
        "**Yesterday:** Planned Sprint 1 with Yunhong.",
        "**Today:** Finish the PRD (#1) and open the PR.",
        "**Blockers:** None.",
        "",
        "### Yunhong Huang",
        "",
        "#### 2026-11-01",
        "**Yesterday:** CI pipeline with Vercel previews is up for review (#4).",
        "**Today:** Sprint planning with requirements (#8).",
        "**Blockers:** Waiting on reviews for #107 and #108.",
        "",
        "## Retro and peer feedback",
        "Retro items, action items and peer feedback aren't recorded in SprintProof yet. Team exports leave out peer feedback.",
        "",
      ].join("\n")
    );
  });

  it("says when a member has no standups in the sprint", () => {
    // Arrange
    const summary = createSprintSummary({
      members: [createMemberSummary(YUNHONG)],
    });

    // Act
    const markdown = buildSprintSummaryMarkdown({
      team,
      summary,
      standups: [],
      audience: "TEAM",
    });

    // Assert
    expect(section(markdown, "### Yunhong Huang")).toEqual([
      "",
      "No standups in Sprint 1.",
      "",
    ]);
  });

  it("lists standups only under the members the summary counts", () => {
    // Arrange
    const summary = createSprintSummary({
      members: [createMemberSummary(ZIQI)],
    });
    const standups = [
      createStandupEntry({ userId: "user-not-on-team", today: "Not listed." }),
    ];

    // Act
    const markdown = buildSprintSummaryMarkdown({
      team,
      summary,
      standups,
      audience: "TEAM",
    });

    // Assert
    expect(markdown).not.toContain("Not listed.");
    expect(section(markdown, "### Ziqi (Odie) Yang")).toContain(
      "No standups in Sprint 1."
    );
  });

  it("names a member without a name by their GitHub login", () => {
    // Arrange
    const summary = createSprintSummary({
      members: [createMemberSummary({ name: null, githubLogin: "santiaojun" })],
    });

    // Act
    const markdown = buildSprintSummaryMarkdown({
      team,
      summary,
      standups: [],
      audience: "TEAM",
    });

    // Assert
    expect(section(markdown, "## Requirements")[2]).toMatch(
      /^\| santiaojun \| @santiaojun \|/
    );
    expect(markdown).toContain("### santiaojun");
  });

  it("writes a dash for a member with no GitHub login", () => {
    // Arrange
    const summary = createSprintSummary({
      members: [createMemberSummary({ name: "Priya", githubLogin: null })],
    });

    // Act
    const markdown = buildSprintSummaryMarkdown({
      team,
      summary,
      standups: [],
      audience: "TEAM",
    });

    // Assert
    expect(section(markdown, "## Requirements")[2]).toMatch(
      /^\| Priya \| — \|/
    );
  });

  it("keeps each table row and standup answer on one line", () => {
    // Arrange
    const summary = createSprintSummary({
      members: [
        createMemberSummary({ userId: "user-1", name: "Ziqi | Odie\nYang" }),
      ],
    });
    const standups = [
      createStandupEntry({
        userId: "user-1",
        yesterday: "Wrote the PRD.\n\nOpened the PR.",
        today: "Mockups\nand tokens.",
        blockers: "Waiting on\n  a review.",
      }),
    ];

    // Act
    const markdown = buildSprintSummaryMarkdown({
      team,
      summary,
      standups,
      audience: "TEAM",
    });

    // Assert
    expect(section(markdown, "## Requirements")[2]).toMatch(
      /^\| Ziqi \\\| Odie Yang \| @user1 \|/
    );
    expect(markdown).toContain("**Yesterday:** Wrote the PRD. Opened the PR.");
    expect(markdown).toContain("**Today:** Mockups and tokens.");
    expect(markdown).toContain("**Blockers:** Waiting on a review.");
  });

  it("says how many days are left in a running sprint", () => {
    // Arrange
    const summary = createSprintSummary();
    summary.sprint.daysLeft = 1;

    // Act
    const markdown = buildSprintSummaryMarkdown({
      team,
      summary,
      standups: [],
      audience: "TEAM",
    });

    // Assert
    expect(markdown).toContain(
      "**Dates:** 2026-10-29 – 2026-11-04 · 1 day left ·"
    );
  });

  it("says an ended sprint has ended", () => {
    // Arrange
    const summary = createSprintSummary({
      countsAsOf: new Date("2026-11-11T20:00:00Z"),
      members: [
        createMemberSummary({
          ...ZIQI,
          standups: { count: 2, required: 3, remaining: 1, status: "MISSED" },
        }),
      ],
    });
    summary.sprint.state = "ENDED";
    summary.sprint.daysLeft = 0;

    // Act
    const markdown = buildSprintSummaryMarkdown({
      team,
      summary,
      standups: [],
      audience: "TEAM",
    });

    // Assert
    expect(markdown).toContain(
      "**Dates:** 2026-10-29 – 2026-11-04 · Ended · **Counts as of:** 2026-11-11"
    );
    expect(section(markdown, "## Requirements")[2]).toContain(
      "| 2 / 3 · Missed |"
    );
  });

  it("dates the counts in the team's timezone", () => {
    // Arrange: Nov 4, 1 AM UTC is still Nov 3 in Los Angeles
    const summary = createSprintSummary({
      countsAsOf: new Date("2026-11-04T01:00:00Z"),
    });

    // Act
    const markdown = buildSprintSummaryMarkdown({
      team,
      summary,
      standups: [],
      audience: "TEAM",
    });

    // Assert
    expect(markdown).toContain("**Counts as of:** 2026-11-03");
  });

  it("shows counts without a status before the sprint starts", () => {
    // Arrange
    const summary = createSprintSummary({
      members: [
        createMemberSummary({
          ...ZIQI,
          standups: { count: 0, required: 3, remaining: 3, status: null },
          reviews: { count: 0, required: 5, remaining: 5, status: null },
        }),
      ],
    });
    summary.sprint.state = "UPCOMING";

    // Act
    const markdown = buildSprintSummaryMarkdown({
      team,
      summary,
      standups: [],
      audience: "TEAM",
    });

    // Assert
    expect(section(markdown, "## Requirements")[2]).toBe(
      "| Ziqi (Odie) Yang | @Odiethebest | 0 / 3 | 0 / 5 | 0 | 0 |"
    );
  });

  it("tells instructors that retro items, action items and peer feedback aren't recorded yet", () => {
    // Act
    const markdown = buildSprintSummaryMarkdown({
      team,
      summary: createSprintSummary(),
      standups: [],
      audience: "INSTRUCTOR",
    });

    // Assert
    expect(section(markdown, "## Retro and peer feedback")).toEqual([
      "Retro items, action items and peer feedback aren't recorded in SprintProof yet.",
      "",
    ]);
  });
});

describe("getExportAudience", () => {
  it("gives instructors the instructor export", () => {
    // Act
    const audience = getExportAudience({ role: "INSTRUCTOR" });

    // Assert
    expect(audience).toBe("INSTRUCTOR");
  });

  it.each(["LEAD", "MEMBER"] as const)(
    "gives a %s the team export, without peer feedback",
    (role) => {
      // Act
      const audience = getExportAudience({ role });

      // Assert
      expect(audience).toBe("TEAM");
    }
  );
});
