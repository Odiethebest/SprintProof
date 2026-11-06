import { Pill } from "@/components/ui/pill";

export function RepositoryCard({
  repoFullName,
  webhookUrl,
  isLead,
  lastDeliveryFormatted,
}: {
  repoFullName: string;
  webhookUrl: string | null;
  isLead: boolean;
  lastDeliveryFormatted?: string | null;
}) {
  return (
    <section
      aria-labelledby="repository-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="repository-title" className="text-lg font-semibold">
          Repository
        </h2>
        <p className="text-xs text-text-muted">
          SprintProof records commits, pull requests and reviews through a
          GitHub webhook.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-text-muted">Connected repository</span>
          <span className="truncate font-mono text-sm font-medium">
            {repoFullName}
          </span>
        </div>
        <Pill>Connected</Pill>
      </div>

      {isLead && webhookUrl && (
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text">Webhook URL</span>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-canvas px-3 py-2">
              <span className="truncate font-mono text-xs select-all">
                {webhookUrl}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-xs text-text-muted">
            <span className="font-medium text-text">Subscribed events</span>
            <span>Pushes, pull requests, pull request reviews</span>
          </div>

          <div className="flex flex-col gap-1 text-xs text-text-muted">
            <span className="font-medium text-text">Last delivery</span>
            <span>{lastDeliveryFormatted ?? "No deliveries yet"}</span>
          </div>

          <details className="group flex flex-col gap-2 rounded-md border border-border p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-text hover:text-primary">
              <span>Webhook setup steps</span>
              <span
                aria-hidden="true"
                className="text-xs text-text-muted transition-transform group-open:rotate-180"
              >
                ▼
              </span>
            </summary>
            <ol className="mt-2 flex flex-col gap-2 list-inside list-decimal text-xs text-text-muted">
              <li>
                In your GitHub repository, open <strong>Settings</strong> →{" "}
                <strong>Webhooks</strong> → <strong>Add webhook</strong>.
              </li>
              <li>
                Paste the Webhook URL into <strong>Payload URL</strong>.
              </li>
              <li>
                Set <strong>Content type</strong> to{" "}
                <code className="font-mono">application/json</code>.
              </li>
              <li>
                Enter the team webhook secret into <strong>Secret</strong>.
              </li>
              <li>
                Under{" "}
                <strong>Which events would you like to trigger this webhook?</strong>
                , select <strong>Let me select individual events</strong>.
              </li>
              <li>
                Check <strong>Pushes</strong>, <strong>Pull requests</strong>,
                and <strong>Pull request reviews</strong>.
              </li>
              <li>
                Ensure <strong>Active</strong> is checked, then click{" "}
                <strong>Add webhook</strong>.
              </li>
            </ol>
          </details>
        </div>
      )}
    </section>
  );
}
