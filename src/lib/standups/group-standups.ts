export interface DatedStandup {
  date: string;
  createdAt: Date;
}

export interface StandupDay<Standup extends DatedStandup> {
  date: string;
  standups: Standup[];
}

export interface GroupStandupsByDayOptions<Standup extends DatedStandup> {
  standups: readonly Standup[];
}

// Dates are YYYY-MM-DD, so comparing the strings orders them by day.
function compareNewestFirst(a: DatedStandup, b: DatedStandup): number {
  if (a.date !== b.date) {
    return a.date < b.date ? 1 : -1;
  }
  return b.createdAt.getTime() - a.createdAt.getTime();
}

// Groups by the stored date, which is the team-timezone day the standup was filed under,
// not by the UTC date of createdAt.
export function groupStandupsByDay<Standup extends DatedStandup>({
  standups,
}: GroupStandupsByDayOptions<Standup>): StandupDay<Standup>[] {
  const days: StandupDay<Standup>[] = [];
  for (const standup of [...standups].sort(compareNewestFirst)) {
    const latestDay = days.at(-1);
    if (latestDay !== undefined && latestDay.date === standup.date) {
      latestDay.standups.push(standup);
    } else {
      days.push({ date: standup.date, standups: [standup] });
    }
  }
  return days;
}
