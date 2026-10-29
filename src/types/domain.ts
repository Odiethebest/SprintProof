export type Role = "LEAD" | "MEMBER" | "INSTRUCTOR";

export type ActivityType = "COMMIT" | "PR_OPENED" | "PR_MERGED" | "REVIEW";

export type RequirementStatus = "MET" | "ON_TRACK" | "AT_RISK" | "MISSED";

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
  team?: {
    timezone?: string;
  };
}

export interface Standup {
  id?: string;
  sprintId?: string;
  userId?: string;
  memberId?: string;
  authorId?: string;
  createdAt?: Date | string;
  date?: Date | string;
  postedAt?: Date | string;
  yesterday?: string;
  today?: string;
  blockers?: string | null;
  user?: User;
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
  login?: string;
  prNumber?: number;
  prId?: string | number;
  prAuthor?: string;
  prAuthorLogin?: string;
  prAuthorId?: string;
  isBot?: boolean;
  createdAt?: Date | string;
  timestamp?: Date | string;
  date?: Date | string;
  user?: User;
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

export interface RequirementProgress {
  count: number;
  required: number;
  remaining: number;
  status: RequirementStatus;
}

export interface MemberRequirementStatus {
  memberId: string;
  member: Member;
  standups: RequirementProgress;
  reviews: RequirementProgress;
  prReviews: RequirementProgress;
  requirements: {
    standups: RequirementProgress;
    reviews: RequirementProgress;
    prReviews: RequirementProgress;
  };
}

export type RequirementStatusResult = MemberRequirementStatus[] &
  Record<string, MemberRequirementStatus>;
