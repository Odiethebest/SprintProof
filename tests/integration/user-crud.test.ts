import { describe, it, expect } from "vitest";
import { db } from "@/server/db";

describe("User CRUD integration", () => {
  it("creates a user and reads it back", async () => {
    const user = await db.user.create({
      data: {
        githubId: "gh-101",
        githubLogin: "alice",
        name: "Alice Smith",
      },
    });

    expect(user.id).toBeDefined();
    expect(user.githubLogin).toBe("alice");

    const found = await db.user.findUnique({
      where: { id: user.id },
    });

    expect(found).not.toBeNull();
    expect(found?.id).toBe(user.id);
    expect(found?.githubId).toBe("gh-101");
    expect(found?.githubLogin).toBe("alice");
    expect(found?.name).toBe("Alice Smith");
  });
});
