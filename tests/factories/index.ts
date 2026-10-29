export type Role = "LEAD" | "MEMBER" | "INSTRUCTOR";
export type ActivityType = "COMMIT" | "PR_OPENED" | "PR_MERGED" | "REVIEW";

export interface User {
  id: string;
  name?: string | null;
  login?: string | null;
  githubLogin?: string | null;
  avatarUrl?: string | null;
}

export interface Member {
  id: string;
  userId?: string;
  teamId?: string;
  role?: Role;
  name?: string | null;
  login?: string | null;
  githubLogin?: string | null;
  user?: User;
}

export interface Sprint {
  id: string;
  teamId?: string;
  name?: string;
  startDate: Date | string;
  endDate: Date | string;
  timezone?: string;
  standupsPerPerson?: number;
  reviewsPerPerson?: number;
}

export interface Standup {
  id?: string;
  sprintId?: string;
  userId?: string;
  memberId?: string;
  authorId?: string;
  createdAt: Date | string;
  date?: Date | string;
  postedAt?: Date | string;
  yesterday?: string;
  today?: string;
  blockers?: string | null;
}

export interface Activity {
  id?: string;
  teamId?: string;
  sprintId?: string;
  type: ActivityType | string;
  userId?: string;
  memberId?: string;
  actor?: string;
  githubLogin?: string;
  actorLogin?: string;
  prNumber?: number;
  prId?: string | number;
  prAuthor?: string;
  prAuthorLogin?: string;
  prAuthorId?: string;
  isBot?: boolean;
  createdAt: Date | string;
  timestamp?: Date | string;
  pullRequest?: {
    number?: number;
    id?: string | number;
    authorLogin?: string;
    authorId?: string;
    user?: {
      login?: string;
      id?: string | number;
    };
  };
  payload?: {
    pull_request?: {
      number?: number;
      id?: string | number;
      user?: {
        login?: string;
      };
    };
    review?: {
      state?: string;
    };
  };
}

export function buildSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: "sprint-1",
    teamId: "team-1",
    name: "Sprint 1",
    startDate: "2026-10-29",
    endDate: "2026-11-04",
    timezone: "America/Los_Angeles",
    standupsPerPerson: 3,
    reviewsPerPerson: 5,
    ...overrides,
  };
}

export function buildMember(overrides: Partial<Member> = {}): Member {
  const id = overrides.id ?? "member-1";
  const userId = overrides.userId ?? `user-${id}`;
  const githubLogin = overrides.githubLogin ?? overrides.login ?? "alice";

  return {
    id,
    userId,
    teamId: "team-1",
    role: "MEMBER",
    name: "Alice Developer",
    githubLogin,
    login: githubLogin,
    ...overrides,
  };
}

export function buildStandup(overrides: Partial<Standup> = {}): Standup {
  return {
    id: "standup-1",
    sprintId: "sprint-1",
    memberId: "member-1",
    userId: "user-member-1",
    createdAt: "2026-10-29T17:00:00.000Z", // 10:00 AM PDT
    yesterday: "Worked on requirement status tests",
    today: "Implementing requirement checks",
    blockers: null,
    ...overrides,
  };
}

export function buildActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    teamId: "team-1",
    sprintId: "sprint-1",
    type: "REVIEW",
    memberId: "member-1",
    userId: "user-member-1",
    actor: "alice",
    githubLogin: "alice",
    prNumber: 101,
    prAuthor: "bob",
    prAuthorLogin: "bob",
    createdAt: "2026-10-29T18:00:00.000Z", // 11:00 AM PDT
    ...overrides,
  };
}

export function buildReviewActivity(overrides: Partial<Activity> = {}): Activity {
  return buildActivity({
    type: "REVIEW",
    ...overrides,
  });
}
