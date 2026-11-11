import type { RequirementStatus } from "@/lib/checks";
import { StatusLabel } from "@/components/dashboard/status-label";
import { Avatar } from "@/components/ui/avatar";

export interface ProgressView {
  count: number;
  required: number;
  // null before the sprint starts (AGENTS.md §1 Requirement status).
  status: RequirementStatus | null;
}

export interface RequirementRowView {
  userId: string;
  name: string;
  githubLogin: string | null;
  standups: ProgressView;
  reviews: ProgressView;
  commits: number;
  pullRequests: number;
}

function ProgressCell({ progress }: { progress: ProgressView }) {
  return (
    <td className="whitespace-nowrap py-3 pr-4 align-top">
      <div className="flex flex-col gap-1">
        <span aria-hidden="true" className="font-mono tabular-nums">
          {progress.count} / {progress.required}
        </span>
        {/* Screen readers hear "2 of 3" (AGENTS.md §2 RequirementChecklist). */}
        <span className="sr-only">
          {progress.count} of {progress.required}
        </span>
        {progress.status !== null && <StatusLabel status={progress.status} />}
      </div>
    </td>
  );
}

// AGENTS.md §2 Review "Requirements": one row per member, counts and status
// only, in the team's order (no ranking).
export function RequirementsTable({
  rows,
  countsAsOfLabel,
}: {
  rows: RequirementRowView[];
  countsAsOfLabel: string;
}) {
  return (
    <section
      aria-labelledby="review-requirements-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="review-requirements-title" className="text-lg font-semibold">
          Requirements
        </h2>
        <p className="text-xs text-text-muted">
          Counts as of{" "}
          <span className="font-mono tabular-nums">{countsAsOfLabel}</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-muted">
              <th scope="col" className="pb-2 pr-4 font-medium">
                Member
              </th>
              <th scope="col" className="pb-2 pr-4 font-medium">
                Standups
              </th>
              <th
                scope="col"
                className="whitespace-nowrap pb-2 pr-4 font-medium"
              >
                PR reviews
              </th>
              <th scope="col" className="pb-2 pr-4 font-medium">
                Commits
              </th>
              <th scope="col" className="pb-2 font-medium">
                PRs
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.userId}>
                <th scope="row" className="py-3 pr-4 align-top font-normal">
                  <div className="flex items-center gap-3">
                    <Avatar name={row.name} size="md" />
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium">{row.name}</span>
                      {row.githubLogin !== null && (
                        <span className="text-xs text-text-muted">
                          @{row.githubLogin}
                        </span>
                      )}
                    </div>
                  </div>
                </th>
                <ProgressCell progress={row.standups} />
                <ProgressCell progress={row.reviews} />
                <td className="whitespace-nowrap py-3 pr-4 align-top font-mono tabular-nums">
                  {row.commits}
                </td>
                <td className="whitespace-nowrap py-3 align-top font-mono tabular-nums">
                  {row.pullRequests}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
