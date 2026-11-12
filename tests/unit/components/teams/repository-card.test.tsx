import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RepositoryCard } from "@/components/teams/repository-card";

// The webhook secret field refreshes the page after a rotation, and outside
// Next.js there's no router to provide it.
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

function renderCard({
  isRepoVerified,
  canUseServerWebhookSecret = false,
}: {
  isRepoVerified: boolean;
  canUseServerWebhookSecret?: boolean;
}): string {
  return renderToStaticMarkup(
    <RepositoryCard
      teamId="team-1"
      repoFullName="Odiethebest/SprintProof"
      webhookUrl="https://sprintproof.example/api/webhooks/github"
      webhookSecret={{
        secret: "a".repeat(64),
        last4: "aaaa",
        canUseServerWebhookSecret,
      }}
      isLead
      isRepoVerified={isRepoVerified}
      lastDelivery={null}
    />
  );
}

// The card's text as a reader sees it: no tags, entities decoded.
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

// Decision 007 (#117): a repository is pending until GitHub delivers a ping
// signed with the team's own webhook secret.
describe("RepositoryCard", () => {
  it("says it's waiting for GitHub's ping, not connected, while the repository is pending", () => {
    // Act
    const text = textOf(renderCard({ isRepoVerified: false }));

    // Assert
    expect(text).toContain("Waiting for GitHub's ping");
    expect(text).not.toMatch(/\bConnected\b/);
  });

  it("says Connected once GitHub's ping verified the repository", () => {
    // Act
    const text = textOf(renderCard({ isRepoVerified: true }));

    // Assert
    expect(text).toMatch(/\bConnected\b/);
    expect(text).not.toContain("Waiting for GitHub's ping");
  });

  // A pending team's deliveries never count, whichever secret signed them,
  // so the note about the server-wide secret would be wrong there.
  it("leaves out the server-wide secret note while the repository is pending", () => {
    // Act
    const text = textOf(
      renderCard({ isRepoVerified: false, canUseServerWebhookSecret: true })
    );

    // Assert
    expect(text).not.toContain("server-wide secret");
  });

  it("keeps the server-wide secret note for a connected team that may still use it", () => {
    // Act
    const text = textOf(
      renderCard({ isRepoVerified: true, canUseServerWebhookSecret: true })
    );

    // Assert
    expect(text).toContain("server-wide secret");
  });
});
