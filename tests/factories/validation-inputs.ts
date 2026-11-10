export function createSprintInput(
  overrides: Partial<{
    name: string;
    startDate: string;
    endDate: string;
    standupsPerPerson: number;
    reviewsPerPerson: number;
  }> = {}
) {
  return {
    name: "Sprint 1",
    startDate: "2026-11-01",
    endDate: "2026-11-07",
    standupsPerPerson: 3,
    reviewsPerPerson: 5,
    ...overrides,
  };
}
export function createTeamInput(
  overrides: Partial<{
    name: string;
    repoFullName: string;
    timezone: string;
  }> = {}
) {
  return {
    name: "Team",
    repoFullName: "owner/repo",
    timezone: "UTC",
    ...overrides,
  };
}
export function createStandupInput(
  overrides: Partial<{
    yesterday: string;
    today: string;
    blockers: string;
  }> = {}
) {
  return { yesterday: "Yesterday", today: "Today", blockers: "", ...overrides };
}
