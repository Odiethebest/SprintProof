import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Pusher from "pusher";
import { triggerTeamEvent } from "@/server/realtime";

// The `pusher` package is the external service here; everything else is real.
const { trigger } = vi.hoisted(() => ({ trigger: vi.fn() }));
vi.mock("pusher", () => ({
  default: vi.fn(function () {
    return { trigger };
  }),
}));

const PUSHER_CLOUD = {
  PUSHER_APP_ID: "1234567",
  PUSHER_SECRET: "test-pusher-secret",
  NEXT_PUBLIC_PUSHER_KEY: "test-pusher-key",
  NEXT_PUBLIC_PUSHER_CLUSTER: "mt1",
  NEXT_PUBLIC_PUSHER_HOST: "",
  NEXT_PUBLIC_PUSHER_PORT: "",
};

function setEnv(env: Record<string, string>) {
  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value);
  }
}

describe("triggerTeamEvent", () => {
  beforeEach(() => {
    vi.mocked(Pusher).mockClear();
    trigger.mockReset();
    trigger.mockResolvedValue({ status: 200 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sends the event to the team's channel with an empty payload", async () => {
    // Arrange
    setEnv(PUSHER_CLOUD);

    // Act
    await triggerTeamEvent({ teamId: "team-1", event: "standup.created" });

    // Assert: small events only, never records (AGENTS.md §1 Key patterns)
    expect(Pusher).toHaveBeenCalledWith({
      appId: "1234567",
      key: "test-pusher-key",
      secret: "test-pusher-secret",
      cluster: "mt1",
      useTLS: true,
      timeout: 2000,
    });
    expect(trigger).toHaveBeenCalledExactlyOnceWith(
      "team-team-1",
      "standup.created",
      {}
    );
  });

  it("connects to a local Pusher-compatible server over plain HTTP when a host is set", async () => {
    // Arrange: the Soketi container used in development and E2E
    setEnv({
      ...PUSHER_CLOUD,
      NEXT_PUBLIC_PUSHER_HOST: "localhost",
      NEXT_PUBLIC_PUSHER_PORT: "6001",
    });

    // Act
    await triggerTeamEvent({ teamId: "team-1", event: "activity.created" });

    // Assert
    expect(Pusher).toHaveBeenCalledWith({
      appId: "1234567",
      key: "test-pusher-key",
      secret: "test-pusher-secret",
      host: "localhost",
      port: "6001",
      useTLS: false,
      timeout: 2000,
    });
    expect(trigger).toHaveBeenCalledExactlyOnceWith(
      "team-team-1",
      "activity.created",
      {}
    );
  });

  it("does nothing when Pusher isn't configured", async () => {
    // Arrange
    setEnv({
      PUSHER_APP_ID: "",
      PUSHER_SECRET: "",
      NEXT_PUBLIC_PUSHER_KEY: "",
      NEXT_PUBLIC_PUSHER_CLUSTER: "",
      NEXT_PUBLIC_PUSHER_HOST: "",
      NEXT_PUBLIC_PUSHER_PORT: "",
    });

    // Act
    await triggerTeamEvent({ teamId: "team-1", event: "standup.created" });

    // Assert
    expect(Pusher).not.toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalled();
  });

  it("does nothing when only part of the configuration is set", async () => {
    setEnv({ ...PUSHER_CLOUD, PUSHER_SECRET: "" });

    await triggerTeamEvent({ teamId: "team-1", event: "standup.created" });

    expect(trigger).not.toHaveBeenCalled();
  });

  it("resolves without throwing when Pusher rejects the request, so the saved data still returns", async () => {
    // Arrange
    setEnv(PUSHER_CLOUD);
    trigger.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});

    // Act
    const result = triggerTeamEvent({
      teamId: "team-1",
      event: "standup.created",
    });

    // Assert
    await expect(result).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledTimes(1);
  });
});
