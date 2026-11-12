import { describe, expect, it } from "vitest";
import { toCommitKey } from "@/lib/github/commit-key";

const commit = {
  authorName: "Alice Smith",
  authorEmail: "alice@example.com",
  authorDate: new Date("2026-11-02T18:00:00Z"),
  message: "feat: add the dashboard page\n\nShows each member's counts.",
};

describe("toCommitKey", () => {
  // Rows stored before #114 get their key from git history, so the format must
  // not drift: SHA-256 of the JSON array [name, email, UTC author date, message].
  it("returns the SHA-256 of the author's name, email, UTC author date and message", () => {
    expect(toCommitKey(commit)).toBe(
      "52280213aeea7ba7e103bdb00bbe5b6503b211b434af4b4cfb5987c78c7f4089"
    );
  });

  // GitHub's push payload drops the newline git ends a message with.
  it("gives the same key whether or not the message ends with git's newline", () => {
    expect(toCommitKey({ ...commit, message: `${commit.message}\n` })).toBe(
      toCommitKey(commit)
    );
  });

  it("gives the same key for the same author date written with another UTC offset", () => {
    expect(
      toCommitKey({
        ...commit,
        authorDate: new Date("2026-11-02T10:00:00-08:00"),
      })
    ).toBe(toCommitKey(commit));
  });

  it.each([
    ["author's name", { authorName: "Alice S." }],
    ["author's email", { authorEmail: "alice@users.noreply.github.com" }],
    [
      "author date, by one second",
      { authorDate: new Date("2026-11-02T18:00:01Z") },
    ],
    [
      "message body, with the same first line",
      { message: "feat: add the dashboard page\n\nShows the activity feed." },
    ],
  ])("gives a different key when only the %s differs", (_label, change) => {
    expect(toCommitKey({ ...commit, ...change })).not.toBe(toCommitKey(commit));
  });
});
