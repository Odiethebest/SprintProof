import { db } from "@/server/db";
import type { GithubUser } from "@/lib/github/profile";

// First sign-in creates the user; later sign-ins refresh login, name and avatar.
export async function upsertGithubUser(githubUser: GithubUser) {
  const { githubId, githubLogin, name, avatarUrl } = githubUser;
  return db.$transaction(async (tx) => {
    // After a GitHub rename, another account may now own this login. Free it
    // from the previous holder, who gets their current login at next sign-in.
    await tx.user.updateMany({
      where: { githubLogin, NOT: { githubId } },
      data: { githubLogin: null },
    });
    return tx.user.upsert({
      where: { githubId },
      create: { githubId, githubLogin, name, avatarUrl },
      update: { githubLogin, name, avatarUrl },
    });
  });
}

export async function findUserById(id: string) {
  return db.user.findUnique({ where: { id } });
}
