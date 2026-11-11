const DAY_MS = 24 * 60 * 60 * 1000;

// One or two steps settle on midnight. When a DST change skips midnight, the
// steps alternate between the offsets before and after it and never settle.
const MAX_STEPS = 4;

export interface GetDayStartOptions {
  // A calendar date, "YYYY-MM-DD".
  date: string;
  // An IANA time zone, such as "America/Los_Angeles".
  timeZone: string;
}

type WallClockReader = (instant: number) => number;

// The wall clock in `timeZone` at an instant, written as the UTC timestamp with
// the same fields: 01:00 on 2026-03-08 in Havana reads as Date.UTC(2026, 2, 8, 1).
// The offset comes from Intl, so the host's own time zone plays no part (#99).
function createWallClockReader(timeZone: string): WallClockReader {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  return (instant) => {
    const parts = format.formatToParts(instant);
    const field = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    // Intl leaves out milliseconds; offsets are whole seconds, so they carry over.
    const milliseconds = instant - Math.floor(instant / 1000) * 1000;
    return (
      Date.UTC(
        field("year"),
        field("month") - 1,
        field("day"),
        field("hour"),
        field("minute"),
        field("second")
      ) + milliseconds
    );
  };
}

// Moves `guess` by the offset in effect at it until that offset makes it read
// `wallClock`. Null when no instant reads it.
function settleOnWallClock(
  wallClock: number,
  guess: number,
  readWallClock: WallClockReader
): number | null {
  let instant = guess;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const next = instant - (readWallClock(instant) - wallClock);
    if (next === instant) {
      return instant;
    }
    instant = next;
  }
  return null;
}

// The first instant of a calendar day in a time zone: 00:00, the first of the
// two 00:00s when a DST change repeats midnight, or the first instant after the
// gap when a DST change skips midnight (AGENTS.md §1 Timezone).
export function getDayStart({ date, timeZone }: GetDayStartOptions): Date {
  const readWallClock = createWallClockReader(timeZone);
  const [year, month, day] = date.split("-").map(Number);
  // 00:00 on `date` as a wall-clock reading.
  const midnight = Date.UTC(year, month - 1, day);

  // Guess with the offsets a day either side, so a DST change near midnight
  // falls between the two guesses.
  const guesses = [midnight - DAY_MS, midnight + DAY_MS].map(
    (instant) => midnight - (readWallClock(instant) - instant)
  );
  const midnights = [...new Set(guesses)]
    .map((guess) => settleOnWallClock(midnight, guess, readWallClock))
    .filter((instant) => instant !== null);
  if (midnights.length > 0) {
    return new Date(Math.min(...midnights));
  }

  // No instant reads 00:00: the clocks jump past it between the two guesses,
  // and the day starts at that jump.
  let before = Math.min(...guesses);
  let atOrAfter = Math.max(...guesses);
  while (atOrAfter - before > 1) {
    const middle = Math.floor((before + atOrAfter) / 2);
    if (readWallClock(middle) >= midnight) {
      atOrAfter = middle;
    } else {
      before = middle;
    }
  }
  return new Date(atOrAfter);
}
