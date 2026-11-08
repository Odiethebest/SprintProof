"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Pusher, { type Options } from "pusher-js";
import { TEAM_EVENTS, getTeamChannel } from "@/lib/realtime/team-events";

export type LiveState = "CONNECTING" | "LIVE" | "RECONNECTING";

// A push with several commits can arrive as a burst of deliveries; they share one refetch.
const REFRESH_DELAY_MS = 250;

// null: live updates are off on this deployment (no Pusher settings).
const LiveStateContext = createContext<LiveState | null>(null);

// Next.js inlines NEXT_PUBLIC_ variables into the browser bundle only when
// each one is read by its full name.
function readPusherSettings(): { key: string; options: Options } | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  const host = process.env.NEXT_PUBLIC_PUSHER_HOST;
  const port = process.env.NEXT_PUBLIC_PUSHER_PORT;
  if (!key || !cluster) {
    return null;
  }
  if (!host) {
    return { key, options: { cluster } };
  }
  // A local Pusher-compatible server (Soketi) in development and E2E.
  return {
    key,
    options: {
      cluster,
      wsHost: host,
      ...(port ? { wsPort: Number(port) } : {}),
      forceTLS: false,
      enabledTransports: ["ws"],
    },
  };
}

export function useLiveState(): LiveState | null {
  return useContext(LiveStateContext);
}

// Real-time flow (AGENTS.md §1): listens on the team's channel and refetches
// the page's server data when something changes. Events carry no records.
export function TeamLiveProvider({
  teamId,
  children,
}: {
  teamId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [liveState, setLiveState] = useState<LiveState | null>(() =>
    readPusherSettings() === null ? null : "CONNECTING"
  );

  useEffect(() => {
    const settings = readPusherSettings();
    if (settings === null) {
      return;
    }
    const pusher = new Pusher(settings.key, settings.options);
    const channelName = getTeamChannel({ teamId });
    const channel = pusher.subscribe(channelName);
    let hasSubscribed = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleRefresh() {
      if (refreshTimer !== null) {
        return;
      }
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, REFRESH_DELAY_MS);
    }

    // "Live" once events can actually arrive, so after the channel subscription.
    channel.bind("pusher:subscription_succeeded", () => {
      // Events sent while the connection was down are lost, so catch up once.
      if (hasSubscribed) {
        scheduleRefresh();
      }
      hasSubscribed = true;
      setLiveState("LIVE");
    });
    pusher.connection.bind(
      "state_change",
      ({ current }: { current: string }) => {
        if (current !== "connected") {
          setLiveState(hasSubscribed ? "RECONNECTING" : "CONNECTING");
        }
      }
    );
    for (const event of TEAM_EVENTS) {
      channel.bind(event, scheduleRefresh);
    }

    return () => {
      if (refreshTimer !== null) {
        clearTimeout(refreshTimer);
      }
      pusher.disconnect();
    };
  }, [teamId, router]);

  return (
    <LiveStateContext.Provider value={liveState}>
      {children}
    </LiveStateContext.Provider>
  );
}
