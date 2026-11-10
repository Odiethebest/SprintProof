import Pusher from "pusher";
import { z } from "zod";
import { getTeamChannel, type TeamEvent } from "@/lib/realtime/team-events";

// Empty values count as unset, so a blank line in .env leaves live updates off.
const optionalSetting = z
  .string()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const pusherSettingsSchema = z.object({
  appId: z.string().min(1),
  secret: z.string().min(1),
  key: z.string().min(1),
  cluster: z.string().min(1),
  host: optionalSetting,
  port: optionalSetting,
});

// One client per call: settings are read from the environment each time, and
// a trigger is a single HTTP request, so there's nothing worth keeping.
function createPusherClient(): Pusher | null {
  const parsed = pusherSettingsSchema.safeParse({
    appId: process.env.PUSHER_APP_ID,
    secret: process.env.PUSHER_SECRET,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    host: process.env.NEXT_PUBLIC_PUSHER_HOST,
    port: process.env.NEXT_PUBLIC_PUSHER_PORT,
  });
  if (!parsed.success) {
    return null;
  }
  const { appId, secret, key, cluster, host, port } = parsed.data;
  if (host === undefined) {
    return new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
      timeout: 2000,
    });
  }
  // A local Pusher-compatible server (Soketi) in development and E2E.
  return new Pusher({
    appId,
    key,
    secret,
    host,
    ...(port === undefined ? {} : { port }),
    useTLS: false,
    timeout: 2000,
  });
}

// Tells everyone watching the team that something changed. Never throws: the
// data is already saved, and the page shows it on the next load if the event
// is lost (PRD: a missed live update never leaves the page wrong).
export async function triggerTeamEvent({
  teamId,
  event,
}: {
  teamId: string;
  event: TeamEvent;
}): Promise<void> {
  try {
    const pusher = createPusherClient();
    if (pusher === null) {
      return;
    }
    const channel = getTeamChannel({ teamId });
    await pusher.trigger(channel, event, {});
  } catch (error) {
    console.error(
      `Couldn't send ${event}:`,
      error instanceof Error ? error.message : error
    );
  }
}
