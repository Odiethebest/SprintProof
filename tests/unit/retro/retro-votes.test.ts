import { beforeEach, describe, expect, it } from "vitest";
import {
  ACTION_ITEMS_PER_RETRO,
  MAX_VOTES_PER_RETRO,
  countVotesLeft,
  decideVote,
  selectActionItems,
  sortRetroItems,
  tallyRetroItems,
} from "@/lib/retro/retro-votes";
import {
  createRetroItem,
  createRetroVotes,
  resetRetroItemSeq,
} from "../../factories";

const ZIQI = "user-ziqi";
const YUNHONG = "user-yunhong";

beforeEach(() => {
  resetRetroItemSeq();
});

describe("MAX_VOTES_PER_RETRO", () => {
  it("gives each member 3 votes per retro (rule R6)", () => {
    // Assert
    expect(MAX_VOTES_PER_RETRO).toBe(3);
  });
});

describe("ACTION_ITEMS_PER_RETRO", () => {
  it("turns the top 3 items into action items (rule R6)", () => {
    // Assert
    expect(ACTION_ITEMS_PER_RETRO).toBe(3);
  });
});

describe("tallyRetroItems", () => {
  it("counts each item's votes", () => {
    // Arrange
    const item = createRetroItem();
    const votes = createRetroVotes({
      itemId: item.id,
      userIds: [ZIQI, YUNHONG],
    });

    // Act
    const [tallied] = tallyRetroItems({ items: [item], votes, voterId: ZIQI });

    // Assert
    expect(tallied.voteCount).toBe(2);
  });

  it("gives an item nobody voted for 0 votes", () => {
    // Arrange
    const item = createRetroItem();

    // Act
    const [tallied] = tallyRetroItems({
      items: [item],
      votes: [],
      voterId: ZIQI,
    });

    // Assert
    expect(tallied.voteCount).toBe(0);
  });

  it("marks the items the voter voted for", () => {
    // Arrange
    const voted = createRetroItem();
    const other = createRetroItem();
    const votes = [
      ...createRetroVotes({ itemId: voted.id, userIds: [ZIQI] }),
      ...createRetroVotes({ itemId: other.id, userIds: [YUNHONG] }),
    ];

    // Act
    const tallied = tallyRetroItems({
      items: [voted, other],
      votes,
      voterId: ZIQI,
    });

    // Assert
    expect(tallied.map(({ id, hasVoted }) => ({ id, hasVoted }))).toEqual([
      { id: voted.id, hasVoted: true },
      { id: other.id, hasVoted: false },
    ]);
  });

  it("sorts items by votes, most first", () => {
    // Arrange
    const one = createRetroItem();
    const two = createRetroItem();
    const none = createRetroItem();
    const votes = [
      ...createRetroVotes({ itemId: one.id, userIds: [ZIQI] }),
      ...createRetroVotes({ itemId: two.id, userIds: [ZIQI, YUNHONG] }),
    ];

    // Act
    const tallied = tallyRetroItems({
      items: [none, one, two],
      votes,
      voterId: ZIQI,
    });

    // Assert
    expect(tallied.map(({ id }) => id)).toEqual([two.id, one.id, none.id]);
  });

  it("puts the earliest created first when votes tie", () => {
    // Arrange
    const earlier = createRetroItem({
      createdAt: new Date("2026-11-03T17:00:00Z"),
    });
    const later = createRetroItem({
      createdAt: new Date("2026-11-03T18:00:00Z"),
    });

    // Act
    const tallied = tallyRetroItems({
      items: [later, earlier],
      votes: [],
      voterId: ZIQI,
    });

    // Assert
    expect(tallied.map(({ id }) => id)).toEqual([earlier.id, later.id]);
  });

  it("keeps the item's own fields", () => {
    // Arrange
    const item = createRetroItem({
      column: "WENT_WELL",
      text: "CI catches broken builds before review",
    });

    // Act
    const [tallied] = tallyRetroItems({
      items: [item],
      votes: [],
      voterId: ZIQI,
    });

    // Assert
    expect(tallied).toEqual({
      ...item,
      voteCount: 0,
      hasVoted: false,
    });
  });

  it("returns nothing for a retro with no items", () => {
    // Act
    const tallied = tallyRetroItems({ items: [], votes: [], voterId: ZIQI });

    // Assert
    expect(tallied).toEqual([]);
  });
});

describe("sortRetroItems", () => {
  it("sorts by votes, then earliest created, then id, so the order never depends on input order", () => {
    // Arrange: b and c tie on votes and creation time
    const createdAt = new Date("2026-11-03T17:00:00Z");
    const a = { id: "a", createdAt, voteCount: 2 };
    const c = { id: "c", createdAt, voteCount: 1 };
    const b = { id: "b", createdAt, voteCount: 1 };

    // Act
    const sorted = sortRetroItems({ items: [c, b, a] });

    // Assert
    expect(sorted.map(({ id }) => id)).toEqual(["a", "b", "c"]);
  });

  it("leaves the input array as it was", () => {
    // Arrange
    const createdAt = new Date("2026-11-03T17:00:00Z");
    const items = [
      { id: "b", createdAt, voteCount: 0 },
      { id: "a", createdAt, voteCount: 1 },
    ];

    // Act
    sortRetroItems({ items });

    // Assert
    expect(items.map(({ id }) => id)).toEqual(["b", "a"]);
  });
});

describe("selectActionItems", () => {
  it("picks the 3 'To improve' items with the most votes (rule R6)", () => {
    // Arrange
    const items = [
      createRetroItem({ text: "Agree on Prisma migration naming" }),
      createRetroItem({ text: "Some PRs still wait more than a day" }),
      createRetroItem({ text: "Split the dashboard work" }),
      createRetroItem({ text: "Write tomorrow's plan in the standup" }),
    ];
    const votes = [
      ...createRetroVotes({ itemId: items[1].id, userIds: [ZIQI, YUNHONG] }),
      ...createRetroVotes({ itemId: items[2].id, userIds: [ZIQI] }),
      ...createRetroVotes({ itemId: items[3].id, userIds: [YUNHONG] }),
    ];

    // Act
    const actionItems = selectActionItems({ items, votes });

    // Assert
    expect(
      actionItems.map(({ text, voteCount }) => ({ text, voteCount }))
    ).toEqual([
      { text: "Some PRs still wait more than a day", voteCount: 2 },
      { text: "Split the dashboard work", voteCount: 1 },
      { text: "Write tomorrow's plan in the standup", voteCount: 1 },
    ]);
  });

  it("breaks a tie for third place by the earliest created item", () => {
    // Arrange: four items with one vote each
    const items = [
      createRetroItem({ createdAt: new Date("2026-11-03T20:00:00Z") }),
      createRetroItem({ createdAt: new Date("2026-11-03T17:00:00Z") }),
      createRetroItem({ createdAt: new Date("2026-11-03T19:00:00Z") }),
      createRetroItem({ createdAt: new Date("2026-11-03T18:00:00Z") }),
    ];
    const votes = items.flatMap((item) =>
      createRetroVotes({ itemId: item.id, userIds: [ZIQI] })
    );

    // Act
    const actionItems = selectActionItems({ items, votes });

    // Assert
    expect(actionItems.map(({ id }) => id)).toEqual([
      items[1].id,
      items[3].id,
      items[2].id,
    ]);
  });

  it("never picks a 'Went well' item, however many votes it has", () => {
    // Arrange
    const wentWell = createRetroItem({ column: "WENT_WELL" });
    const toImprove = createRetroItem({ column: "TO_IMPROVE" });
    const votes = createRetroVotes({
      itemId: wentWell.id,
      userIds: [ZIQI, YUNHONG],
    });

    // Act
    const actionItems = selectActionItems({
      items: [wentWell, toImprove],
      votes,
    });

    // Assert
    expect(actionItems.map(({ id }) => id)).toEqual([toImprove.id]);
  });

  it("picks every 'To improve' item when there are fewer than 3", () => {
    // Arrange
    const items = [createRetroItem(), createRetroItem()];

    // Act
    const actionItems = selectActionItems({ items, votes: [] });

    // Assert
    expect(actionItems).toHaveLength(2);
  });

  it("picks the earliest 'To improve' items when nobody voted", () => {
    // Arrange
    const items = [
      createRetroItem(),
      createRetroItem(),
      createRetroItem(),
      createRetroItem(),
    ];

    // Act
    const actionItems = selectActionItems({ items, votes: [] });

    // Assert
    expect(actionItems.map(({ id }) => id)).toEqual([
      items[0].id,
      items[1].id,
      items[2].id,
    ]);
  });

  it("picks nothing from a retro with no 'To improve' items", () => {
    // Arrange
    const items = [createRetroItem({ column: "WENT_WELL" })];

    // Act
    const actionItems = selectActionItems({ items, votes: [] });

    // Assert
    expect(actionItems).toEqual([]);
  });
});

describe("countVotesLeft", () => {
  it("leaves all 3 votes to a member who hasn't voted", () => {
    // Act
    const votesLeft = countVotesLeft({ votes: [], voterId: ZIQI });

    // Assert
    expect(votesLeft).toBe(3);
  });

  it("takes one vote off for each item the member voted for", () => {
    // Arrange
    const votes = [
      { itemId: "item-1", userId: ZIQI },
      { itemId: "item-2", userId: ZIQI },
    ];

    // Act
    const votesLeft = countVotesLeft({ votes, voterId: ZIQI });

    // Assert
    expect(votesLeft).toBe(1);
  });

  it("doesn't count a teammate's votes against the member", () => {
    // Arrange
    const votes = [
      { itemId: "item-1", userId: YUNHONG },
      { itemId: "item-2", userId: YUNHONG },
      { itemId: "item-3", userId: YUNHONG },
    ];

    // Act
    const votesLeft = countVotesLeft({ votes, voterId: ZIQI });

    // Assert
    expect(votesLeft).toBe(3);
  });

  it("never goes below 0", () => {
    // Arrange: more votes than allowed, as rows written before a fix could be
    const votes = ["item-1", "item-2", "item-3", "item-4"].map((itemId) => ({
      itemId,
      userId: ZIQI,
    }));

    // Act
    const votesLeft = countVotesLeft({ votes, voterId: ZIQI });

    // Assert
    expect(votesLeft).toBe(0);
  });
});

describe("decideVote", () => {
  it("adds a vote for an item the member hasn't voted for", () => {
    // Act
    const decision = decideVote({
      votes: [],
      voterId: ZIQI,
      itemId: "item-1",
      isVoting: true,
    });

    // Assert
    expect(decision).toBe("ADD");
  });

  it("keeps one vote when the member votes for the same item again (max 1 per item)", () => {
    // Arrange
    const votes = [{ itemId: "item-1", userId: ZIQI }];

    // Act
    const decision = decideVote({
      votes,
      voterId: ZIQI,
      itemId: "item-1",
      isVoting: true,
    });

    // Assert
    expect(decision).toBe("UNCHANGED");
  });

  it("refuses a 4th vote in the same retro", () => {
    // Arrange
    const votes = ["item-1", "item-2", "item-3"].map((itemId) => ({
      itemId,
      userId: ZIQI,
    }));

    // Act
    const decision = decideVote({
      votes,
      voterId: ZIQI,
      itemId: "item-4",
      isVoting: true,
    });

    // Assert
    expect(decision).toBe("NO_VOTES_LEFT");
  });

  it("lets a member vote while teammates have used all of theirs", () => {
    // Arrange
    const votes = ["item-1", "item-2", "item-3"].map((itemId) => ({
      itemId,
      userId: YUNHONG,
    }));

    // Act
    const decision = decideVote({
      votes,
      voterId: ZIQI,
      itemId: "item-1",
      isVoting: true,
    });

    // Assert
    expect(decision).toBe("ADD");
  });

  it("removes the member's vote when they take it back (toggle)", () => {
    // Arrange
    const votes = [{ itemId: "item-1", userId: ZIQI }];

    // Act
    const decision = decideVote({
      votes,
      voterId: ZIQI,
      itemId: "item-1",
      isVoting: false,
    });

    // Assert
    expect(decision).toBe("REMOVE");
  });

  it("lets a member with no votes left take one back", () => {
    // Arrange
    const votes = ["item-1", "item-2", "item-3"].map((itemId) => ({
      itemId,
      userId: ZIQI,
    }));

    // Act
    const decision = decideVote({
      votes,
      voterId: ZIQI,
      itemId: "item-2",
      isVoting: false,
    });

    // Assert
    expect(decision).toBe("REMOVE");
  });

  it("changes nothing when the member takes back a vote they never cast", () => {
    // Arrange: only a teammate voted for the item
    const votes = [{ itemId: "item-1", userId: YUNHONG }];

    // Act
    const decision = decideVote({
      votes,
      voterId: ZIQI,
      itemId: "item-1",
      isVoting: false,
    });

    // Assert
    expect(decision).toBe("UNCHANGED");
  });
});
