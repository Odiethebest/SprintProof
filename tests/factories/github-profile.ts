import type { GithubUser } from "@/lib/github/profile";

// The fields of GitHub's `GET /user` response that sign-in reads, plus `email`,
// which the public profile may include and SprintProof must ignore (decision 001).
export interface GithubProfileFixture {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

export function createGithubProfile(
  overrides: Partial<GithubProfileFixture> = {}
): GithubProfileFixture {
  return {
    id: 1001,
    login: "octo",
    name: "Octo Cat",
    avatar_url: "https://avatars.githubusercontent.com/u/1001?v=4",
    email: null,
    ...overrides,
  };
}

export function createGithubUser(
  overrides: Partial<GithubUser> = {}
): GithubUser {
  return {
    githubId: "1001",
    githubLogin: "octo",
    name: "Octo Cat",
    avatarUrl: "https://avatars.githubusercontent.com/u/1001?v=4",
    ...overrides,
  };
}
