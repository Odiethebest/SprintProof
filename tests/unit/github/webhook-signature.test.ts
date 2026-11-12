import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import {
  findSigningTeamId,
  matchWebhookSecret,
  verifyWebhookSignature,
} from "@/lib/github/webhook-signature";

function createSignature(payload: string, secret: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
}

describe("verifyWebhookSignature", () => {
  const secret = "test-secret-12345";
  const payload = JSON.stringify({ zen: "Responsive is better than fast." });

  it("returns true for a matching signature", () => {
    const signatureHeader = createSignature(payload, secret);
    expect(
      verifyWebhookSignature({
        rawBody: payload,
        signatureHeader,
        secret,
      })
    ).toBe(true);
  });

  // An unset GITHUB_WEBHOOK_SECRET must not turn into a key anyone can sign with.
  it("returns false when the secret is empty, even for a body signed with an empty key", () => {
    const signatureHeader = createSignature(payload, "");
    expect(
      verifyWebhookSignature({
        rawBody: payload,
        signatureHeader,
        secret: "",
      })
    ).toBe(false);
  });

  it("returns false when the signature header is null or undefined", () => {
    expect(
      verifyWebhookSignature({
        rawBody: payload,
        signatureHeader: null,
        secret,
      })
    ).toBe(false);
  });

  it("returns false when the signature does not start with sha256=", () => {
    const rawDigest = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    expect(
      verifyWebhookSignature({
        rawBody: payload,
        signatureHeader: rawDigest,
        secret,
      })
    ).toBe(false);
  });

  it("returns false when the secret is different", () => {
    const signatureHeader = createSignature(payload, "wrong-secret");
    expect(
      verifyWebhookSignature({
        rawBody: payload,
        signatureHeader,
        secret,
      })
    ).toBe(false);
  });

  it("returns false when the payload has been tampered with", () => {
    const signatureHeader = createSignature(payload, secret);
    expect(
      verifyWebhookSignature({
        rawBody: payload + " ",
        signatureHeader,
        secret,
      })
    ).toBe(false);
  });

  it("returns false when the signature hex length does not match", () => {
    expect(
      verifyWebhookSignature({
        rawBody: payload,
        signatureHeader: "sha256=abcdef",
        secret,
      })
    ).toBe(false);
  });

  it("verifies an empty payload correctly", () => {
    const emptyPayload = "";
    const signatureHeader = createSignature(emptyPayload, secret);
    expect(
      verifyWebhookSignature({
        rawBody: emptyPayload,
        signatureHeader,
        secret,
      })
    ).toBe(true);
  });
});

// Decision 005 (#115): a delivery is checked against the secret of the team
// its repository belongs to. The server-wide GITHUB_WEBHOOK_SECRET still
// works for a team connected before #115, until GitHub signs a delivery with
// the team's own secret, and for a repository no team has connected.
describe("matchWebhookSecret", () => {
  const payload = JSON.stringify({ repository: { id: 1 } });
  const teamSecret = "team-a-secret";
  const otherTeamSecret = "team-b-secret";
  const serverSecret = "server-wide-secret";

  function teamWith(canUseServerWebhookSecret: boolean) {
    return { webhookSecret: teamSecret, canUseServerWebhookSecret };
  }

  it("returns TEAM_SECRET for a body signed with the team's own secret", () => {
    expect(
      matchWebhookSecret({
        rawBody: payload,
        signatureHeader: createSignature(payload, teamSecret),
        team: teamWith(false),
        serverSecret,
      })
    ).toBe("TEAM_SECRET");
  });

  it("returns TEAM_SECRET for the team's own secret while the team can still use the server-wide one", () => {
    expect(
      matchWebhookSecret({
        rawBody: payload,
        signatureHeader: createSignature(payload, teamSecret),
        team: teamWith(true),
        serverSecret,
      })
    ).toBe("TEAM_SECRET");
  });

  it.each([true, false])(
    "returns null for a body signed with another team's secret (server-wide secret allowed: %s)",
    (canUseServerWebhookSecret) => {
      expect(
        matchWebhookSecret({
          rawBody: payload,
          signatureHeader: createSignature(payload, otherTeamSecret),
          team: teamWith(canUseServerWebhookSecret),
          serverSecret,
        })
      ).toBeNull();
    }
  );

  it("returns SERVER_SECRET for the server-wide secret while the team can still use it", () => {
    expect(
      matchWebhookSecret({
        rawBody: payload,
        signatureHeader: createSignature(payload, serverSecret),
        team: teamWith(true),
        serverSecret,
      })
    ).toBe("SERVER_SECRET");
  });

  it("returns null for the server-wide secret once the team can't use it", () => {
    expect(
      matchWebhookSecret({
        rawBody: payload,
        signatureHeader: createSignature(payload, serverSecret),
        team: teamWith(false),
        serverSecret,
      })
    ).toBeNull();
  });

  it("returns SERVER_SECRET for the server-wide secret when no team has the repository", () => {
    expect(
      matchWebhookSecret({
        rawBody: payload,
        signatureHeader: createSignature(payload, serverSecret),
        team: null,
        serverSecret,
      })
    ).toBe("SERVER_SECRET");
  });

  it("returns null for a team's secret when no team has the repository", () => {
    expect(
      matchWebhookSecret({
        rawBody: payload,
        signatureHeader: createSignature(payload, teamSecret),
        team: null,
        serverSecret,
      })
    ).toBeNull();
  });

  // An unset GITHUB_WEBHOOK_SECRET must not turn into a key anyone can sign with.
  it.each([
    ["unset", null],
    ["empty", ""],
  ])(
    "returns null when the server-wide secret is %s, even for a body signed with an empty key",
    (_label, unsetSecret) => {
      const signatureHeader = createSignature(payload, "");
      for (const team of [teamWith(true), null]) {
        expect(
          matchWebhookSecret({
            rawBody: payload,
            signatureHeader,
            team,
            serverSecret: unsetSecret,
          })
        ).toBeNull();
      }
    }
  );

  it("returns null when the signature header is missing", () => {
    expect(
      matchWebhookSecret({
        rawBody: payload,
        signatureHeader: null,
        team: teamWith(true),
        serverSecret,
      })
    ).toBeNull();
  });
});

// Decision 007 (#117): a repository stays pending for every team that claimed
// it until GitHub's ping, signed with one of those teams' secrets, verifies
// that team. The route tries each pending team's secret.
describe("findSigningTeamId", () => {
  const payload = JSON.stringify({ zen: "Keep it logically awesome." });
  const teams = [
    { id: "team-a", webhookSecret: "team-a-secret" },
    { id: "team-b", webhookSecret: "team-b-secret" },
    { id: "team-c", webhookSecret: "team-c-secret" },
  ];

  it.each(["team-a", "team-b", "team-c"])(
    "returns %s for a body signed with its secret",
    (teamId) => {
      expect(
        findSigningTeamId({
          rawBody: payload,
          signatureHeader: createSignature(payload, `${teamId}-secret`),
          teams,
        })
      ).toBe(teamId);
    }
  );

  it("returns null when no team's secret signed the body", () => {
    expect(
      findSigningTeamId({
        rawBody: payload,
        signatureHeader: createSignature(payload, "someone-elses-secret"),
        teams,
      })
    ).toBeNull();
  });

  it("returns null when there are no teams to try", () => {
    expect(
      findSigningTeamId({
        rawBody: payload,
        signatureHeader: createSignature(payload, "team-a-secret"),
        teams: [],
      })
    ).toBeNull();
  });

  it("returns null when the signature header is missing", () => {
    expect(
      findSigningTeamId({ rawBody: payload, signatureHeader: null, teams })
    ).toBeNull();
  });

  it("returns null for a body changed after a team's secret signed it", () => {
    expect(
      findSigningTeamId({
        rawBody: `${payload} `,
        signatureHeader: createSignature(payload, "team-b-secret"),
        teams,
      })
    ).toBeNull();
  });

  // Anyone can compute an HMAC with an empty key.
  it("never matches a team whose secret is empty", () => {
    expect(
      findSigningTeamId({
        rawBody: payload,
        signatureHeader: createSignature(payload, ""),
        teams: [{ id: "team-empty", webhookSecret: "" }],
      })
    ).toBeNull();
  });
});
