import { z } from "zod";

// The GitHub user fields SprintProof stores. Decision 001: no email.
export interface GithubUser {
  githubId: string;
  githubLogin: string;
  name: string | null;
  avatarUrl: string | null;
}

// Subset of GitHub's `GET /user` response. Unknown keys (email included) are dropped.
const githubProfileSchema = z.object({
  id: z.number().int().positive(),
  login: z.string().min(1),
  name: z.string().nullish(),
  avatar_url: z.url(),
});

export function toGithubUser({ profile }: { profile: unknown }): GithubUser {
  const parsed = githubProfileSchema.parse(profile);
  return {
    githubId: String(parsed.id),
    githubLogin: parsed.login,
    name: parsed.name ?? null,
    avatarUrl: parsed.avatar_url,
  };
}
