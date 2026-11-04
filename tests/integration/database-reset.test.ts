import { describe, it, expect } from "vitest";
import { db } from "@/server/db";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Database reset between test files", () => {
  it("shows the table is empty at the start of a new test file", async () => {
    const users = await db.user.findMany();
    expect(users).toHaveLength(0);

    // Insert a user to ensure the table has data during this test
    await db.user.create({
      data: {
        githubId: "gh-102",
        githubLogin: "bob",
        name: "Bob Jones",
      },
    });

    const count = await db.user.count();
    expect(count).toBe(1);
  });
});
