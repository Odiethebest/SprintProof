import { Check, Clock } from "lucide-react";
import {
  WebhookSecretField,
  type WebhookSecretView,
} from "@/components/teams/webhook-secret-field";

export interface WebhookDeliveryView {
  event: string;
  // "Nov 3, 2:41 PM" in the team's timezone (DESIGN.md §9).
  deliveredAtLabel: string;
}

// The webhook URL, secret and setup steps are passed in for the lead only;
// for anyone else they aren't rendered at all (AGENTS.md §2 Settings).
// isRepoVerified: GitHub's ping, signed with the team's secret, verified the
// repository (decision 007, #117). Until then it's pending and nothing counts.
export function RepositoryCard({
  teamId,
  repoFullName,
  webhookUrl,
  webhookSecret,
  isLead,
  isRepoVerified,
  lastDelivery,
}: {
  teamId: string;
  repoFullName: string;
  webhookUrl: string | null;
  webhookSecret: WebhookSecretView | null;
  isLead: boolean;
  isRepoVerified: boolean;
  lastDelivery: WebhookDeliveryView | null;
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

      <div className="flex flex-col gap-2 rounded-md border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-text-muted">GitHub repository</span>
            <span className="truncate font-mono text-sm font-medium">
              {repoFullName}
            </span>
          </div>
          {/* Icon and text, never color alone (AGENTS.md §4). */}
          {isRepoVerified ? (
            <span
              data-testid="repository-connection"
              className="inline-flex shrink-0 items-center gap-1 text-sm text-met"
            >
              <Check size={16} aria-hidden="true" />
              Connected
            </span>
          ) : (
            <span
              data-testid="repository-connection"
              className="inline-flex shrink-0 items-center gap-1 text-sm text-text-muted"
            >
              <Clock size={16} aria-hidden="true" />
              Waiting for GitHub&apos;s ping
            </span>
          )}
        </div>
        {!isRepoVerified && (
          <p className="text-xs text-text-muted">
            GitHub sends a ping when the webhook is added with this team&apos;s
            secret. Activity counts from then on.
          </p>
        )}
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
            {lastDelivery === null ? (
              <span>No deliveries yet</span>
            ) : (
              <>
                <span>
                  <span className="font-mono text-text">
                    {lastDelivery.event}
                  </span>{" "}
                  at {lastDelivery.deliveredAtLabel}
                </span>
                {/* Only deliveries with a valid signature are stored. */}
                <span className="inline-flex items-center gap-1 text-met">
                  <Check size={14} aria-hidden="true" />
                  Verified
                </span>
              </>
            )}
          </div>

          {webhookSecret !== null && (
            <WebhookSecretField
              teamId={teamId}
              webhookSecret={{
                ...webhookSecret,
                // A pending team's deliveries don't count whichever secret
                // signed them (decision 007), so the note about the
                // server-wide secret applies only once it's connected.
                canUseServerWebhookSecret:
                  webhookSecret.canUseServerWebhookSecret && isRepoVerified,
              }}
            />
          )}

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
                Paste the team&apos;s webhook secret into{" "}
                <strong>Secret</strong>: <strong>Copy</strong> next to Webhook
                secret above puts it on your clipboard.
              </li>
              <li>
                Under{" "}
                <strong>
                  Which events would you like to trigger this webhook?
                </strong>
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
              <li>
                GitHub sends a ping right away, and the status next to the
                repository above changes when it arrives. If it doesn&apos;t,
                open the webhook&apos;s <strong>Recent Deliveries</strong> on
                GitHub and redeliver the ping.
              </li>
            </ol>
          </details>
        </div>
      )}
    </section>
  );
}
