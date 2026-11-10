import { createServer } from "node:http";
import type { Socket } from "node:net";
import { expect, it, vi } from "vitest";
import { triggerTeamEvent } from "@/server/realtime";

it("resolves and logs within three seconds when the HTTP server never answers", async () => {
  const sockets = new Set<Socket>();
  const server = createServer(() => {});
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("Missing server port");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  for (const [key, value] of Object.entries({
    PUSHER_APP_ID: "test",
    PUSHER_SECRET: "test-secret",
    NEXT_PUBLIC_PUSHER_KEY: "key",
    NEXT_PUBLIC_PUSHER_CLUSTER: "mt1",
    NEXT_PUBLIC_PUSHER_HOST: "127.0.0.1",
    NEXT_PUBLIC_PUSHER_PORT: String(address.port),
  }))
    vi.stubEnv(key, value);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const started = performance.now();
    const result = await Promise.race([
      triggerTeamEvent({ teamId: "test", event: "standup.created" }).then(
        () => "resolved"
      ),
      new Promise<string>((resolve) => {
        timer = setTimeout(() => resolve("timed out"), 3500);
      }),
    ]);
    expect(result).toBe("resolved");
    expect(performance.now() - started).toBeLessThan(3000);
    expect(log).toHaveBeenCalledOnce();
  } finally {
    clearTimeout(timer);
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  }
}, 6000);
