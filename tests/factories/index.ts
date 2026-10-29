export interface Sprint {
  id?: string;
  name?: string;
  startDate: Date | string;
  endDate: Date | string;
  standupsPerPerson: number;
  reviewsPerPerson: number;
  timezone?: string;
}

export interface Member {
  id: string;
  userId?: string;
  githubLogin?: string;
  role?: "LEAD" | "MEMBER" | "INSTRUCTOR";
}

export interface Standup {
  id?: string;
  userId?: string;
  memberId?: string;
  authorId?: string;
  createdAt: Date | string;
  yesterday?: string;
  today?: string;
  blockers?: string;
}

export interface Activity {
  id?: string;
  type: "COMMIT" | "PR_OPENED" | "PR_MERGED" | "REVIEW" | string;
  userId?: string;
  memberId?: string;
  githubLogin?: string;
  actorLogin?: string;
  prNumber?: number;
  prAuthorLogin?: string;
  prAuthorId?: string;
  createdAt: Date | string;
  metadata?: {
    prNumber?: number;
    prAuthorLogin?: string;
    [key: string]: unknown;
  };
}

export function createSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: "sprint-1",
    name: "Sprint 1",
    startDate: "2026-10-29",
    endDate: "2026-11-04",
    standupsPerPerson: 3,
    reviewsPerPerson: 5,
    timezone: "America/Los_Angeles",
    ...overrides,
  };
}

export function createMember(overrides: Partial<Member> = {}): Member {
  return {
    id: "mem-1",
    userId: "user-1",
    githubLogin: "alice",
    role: "MEMBER",
    ...overrides,
  };
}

export function createStandup(overrides: Partial<Standup> = {}): Standup {
  return {
    id: "standup-1",
    userId: "user-1",
    createdAt: "2026-10-30T10:00:00-07:00",
    yesterday: "Setup project",
    today: "Write tests",
    blockers: "",
    ...overrides,
  };
}

export function createActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    type: "REVIEW",
    userId: "user-1",
    actorLogin: "alice",
    githubLogin: "alice",
    prNumber: 101,
    prAuthorLogin: "bob",
    createdAt: "2026-10-30T14:00:00-07:00",
    ...overrides,
  };
}
