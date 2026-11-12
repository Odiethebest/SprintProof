import { beforeEach, describe, expect, it } from "vitest";
import {
  listTeammates,
  pairPeerFeedback,
} from "@/lib/peer-feedback/peer-feedback-pairs";
import {
  createFeedbackMember,
  createPeerFeedbackEntry,
  resetFeedbackMemberSeq,
} from "../../factories";

const ZIQI = createFeedbackMember({
  userId: "user-ziqi",
  name: "Ziqi (Odie) Yang",
  githubLogin: "Odiethebest",
  role: "LEAD",
});
const YUNHONG = createFeedbackMember({
  userId: "user-yunhong",
  name: "Yunhong Huang",
  githubLogin: "santiaojun",
  role: "MEMBER",
});
const PRIYA = createFeedbackMember({
  userId: "user-priya",
  name: "Priya",
  githubLogin: "priya-ta",
  role: "INSTRUCTOR",
});

describe("listTeammates", () => {
  beforeEach(() => {
    resetFeedbackMemberSeq();
  });

  it("lists the leads and members other than the author, in team order", () => {
    // Arrange
    const maya = createFeedbackMember({ name: "Maya" });

    // Act
    const teammates = listTeammates({
      members: [ZIQI, YUNHONG, maya],
      authorId: YUNHONG.userId,
    });

    // Assert
    expect(teammates).toEqual([ZIQI, maya]);
  });

  it("leaves out instructors, who aren't teammates to give feedback about", () => {
    // Act
    const teammates = listTeammates({
      members: [ZIQI, YUNHONG, PRIYA],
      authorId: ZIQI.userId,
    });

    // Assert
    expect(teammates).toEqual([YUNHONG]);
  });

  it("lists no one for a team of one", () => {
    // Act
    const teammates = listTeammates({
      members: [ZIQI, PRIYA],
      authorId: ZIQI.userId,
    });

    // Assert
    expect(teammates).toEqual([]);
  });
});

describe("pairPeerFeedback", () => {
  beforeEach(() => {
    resetFeedbackMemberSeq();
  });

  it("gives one pair per author and teammate, with the saved feedback or null", () => {
    // Arrange
    const entry = createPeerFeedbackEntry({
      authorId: YUNHONG.userId,
      recipientId: ZIQI.userId,
      text: "Ziqi explains decisions well in PR descriptions.",
      updatedAt: new Date("2026-10-31T17:00:00Z"),
    });

    // Act
    const pairs = pairPeerFeedback({
      members: [ZIQI, YUNHONG],
      entries: [entry],
    });

    // Assert: authors in team order, each about every teammate
    expect(pairs).toEqual([
      { author: ZIQI, recipient: YUNHONG, feedback: null },
      {
        author: YUNHONG,
        recipient: ZIQI,
        feedback: {
          text: "Ziqi explains decisions well in PR descriptions.",
          updatedAt: new Date("2026-10-31T17:00:00Z"),
        },
      },
    ]);
  });

  it("pairs every member with every teammate on a team of three", () => {
    // Arrange
    const maya = createFeedbackMember({ name: "Maya" });

    // Act
    const pairs = pairPeerFeedback({
      members: [ZIQI, YUNHONG, maya],
      entries: [],
    });

    // Assert
    expect(
      pairs.map(({ author, recipient }) => [author.name, recipient.name])
    ).toEqual([
      ["Ziqi (Odie) Yang", "Yunhong Huang"],
      ["Ziqi (Odie) Yang", "Maya"],
      ["Yunhong Huang", "Ziqi (Odie) Yang"],
      ["Yunhong Huang", "Maya"],
      ["Maya", "Ziqi (Odie) Yang"],
      ["Maya", "Yunhong Huang"],
    ]);
  });

  it("leaves instructors out as authors and as teammates", () => {
    // Act
    const pairs = pairPeerFeedback({
      members: [ZIQI, PRIYA, YUNHONG],
      entries: [],
    });

    // Assert
    expect(
      pairs.flatMap(({ author, recipient }) => [author, recipient])
    ).not.toContainEqual(PRIYA);
    expect(pairs).toHaveLength(2);
  });

  it("matches each entry to its own author and teammate only", () => {
    // Arrange: Ziqi wrote about Yunhong, not the other way round
    const entry = createPeerFeedbackEntry({
      authorId: ZIQI.userId,
      recipientId: YUNHONG.userId,
      text: "Reviews were thorough.",
    });

    // Act
    const pairs = pairPeerFeedback({
      members: [ZIQI, YUNHONG],
      entries: [entry],
    });

    // Assert
    expect(pairs[0].feedback?.text).toBe("Reviews were thorough.");
    expect(pairs[1].feedback).toBeNull();
  });

  it("skips an entry from someone who isn't on the team anymore", () => {
    // Arrange
    const entry = createPeerFeedbackEntry({
      authorId: "user-left-the-team",
      recipientId: ZIQI.userId,
      text: "Not listed.",
    });

    // Act
    const pairs = pairPeerFeedback({
      members: [ZIQI, YUNHONG],
      entries: [entry],
    });

    // Assert
    expect(pairs.map((pair) => pair.feedback)).toEqual([null, null]);
  });

  it("gives no pairs for a team of one", () => {
    // Act
    const pairs = pairPeerFeedback({ members: [ZIQI, PRIYA], entries: [] });

    // Assert
    expect(pairs).toEqual([]);
  });
});
