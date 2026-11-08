import type { MappedActivity } from "@/lib/github/webhook-events";
import { getSprintWindow, type SprintDateRange } from "@/lib/sprints";

// An activity as it's stored: `occurredAt` is when it happened on GitHub.
export interface ActivityRecord extends MappedActivity {
  id: string;
}

export interface MemberLogin {
  userId: string;
  githubLogin: string | null;
}

export interface AttributeActivitiesOptions {
  sprint: SprintDateRange;
  timeZone: string;
  members: MemberLogin[];
  activities: ActivityRecord[];
}

export interface AttributedActivity {
  userId: string;
  activity: ActivityRecord;
}

function isBotLogin(login: string): boolean {
  return login.endsWith("[bot]");
}

// Pairs each activity in the sprint with the member whose GitHub login did it.
// Activity from logins that aren't on the team is stored but not counted, and
// bots are ignored for every type (AGENTS.md §1). GitHub logins aren't case-sensitive.
export function attributeActivities({
  sprint,
  timeZone,
  members,
  activities,
}: AttributeActivitiesOptions): AttributedActivity[] {
  const { start, end } = getSprintWindow({ sprint, timeZone });
  const userIdsByLogin = new Map<string, string>();
  for (const member of members) {
    if (member.githubLogin !== null) {
      userIdsByLogin.set(member.githubLogin.toLowerCase(), member.userId);
    }
  }

  const attributed: AttributedActivity[] = [];
  for (const activity of activities) {
    const login = activity.actorLogin.toLowerCase();
    const userId = userIdsByLogin.get(login);
    const time = activity.occurredAt.getTime();
    if (userId === undefined || isBotLogin(login)) {
      continue;
    }
    if (time < start.getTime() || time > end.getTime()) {
      continue;
    }
    attributed.push({ userId, activity });
  }
  return attributed;
}
