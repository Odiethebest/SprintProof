// Day boundaries as Intl reports them, for checking lib date math against, and
// a way to run code as if the machine were in another time zone (#99).

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// UTC is Vercel and CI. Kolkata (+05:30) never changes its clocks. The others
// change theirs on the same weekend as a team zone below, which is where the
// host offset used to leak in: London with Nuuk, Santiago with Lord Howe, Los
// Angeles with Havana.
export const HOST_TIME_ZONES = [
  "UTC",
  "Europe/London",
  "America/Santiago",
  "Asia/Kolkata",
  "America/Los_Angeles",
];

// DST changes at 01:00 UTC (Nuuk, London) and at 02:00 local time (Los
// Angeles); 30-minute changes and a half-hour offset (Lord Howe); a half-hour
// offset with no DST since 2022 (Tehran); changes that skip midnight (Havana,
// Santiago, Cairo, Beirut) or repeat it (Havana).
export const TEAM_TIME_ZONES = [
  "America/Nuuk",
  "America/Havana",
  "America/Santiago",
  "Europe/London",
  "America/Los_Angeles",
  "Australia/Lord_Howe",
  "Asia/Tehran",
  "Africa/Cairo",
  "Asia/Beirut",
];

// Runs `run` as if the machine's time zone were `hostTimeZone`, then puts the
// old one back. Node applies a change to process.env.TZ to every later Date call.
export function withHostTimeZone<T>(hostTimeZone: string, run: () => T): T {
  const original = process.env.TZ;
  process.env.TZ = hostTimeZone;
  try {
    return run();
  } finally {
    if (original === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = original;
    }
  }
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function createDateReader(timeZone: string): (instant: number) => string {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (instant) => {
    const parts = format.formatToParts(instant);
    const field = (type: "year" | "month" | "day") =>
      parts.find((part) => part.type === type)?.value;
    return `${field("year")}-${field("month")}-${field("day")}`;
  };
}

// The first instant whose date in `timeZone` is `date` or later, found by
// bisecting the dates Intl reports: 00:00, or the first instant after the gap
// when a DST change skips midnight.
export function findIntlDayStart({
  date,
  timeZone,
}: {
  date: string;
  timeZone: string;
}): Date {
  const readDate = createDateReader(timeZone);
  // Every zone is within 14 hours of UTC, so these bracket the start.
  let before = Date.parse(`${date}T00:00:00.000Z`) - 26 * HOUR_MS;
  let atOrAfter = before + 52 * HOUR_MS;
  while (atOrAfter - before > 1) {
    const middle = Math.floor((before + atOrAfter) / 2);
    if (readDate(middle) >= date) {
      atOrAfter = middle;
    } else {
      before = middle;
    }
  }
  return new Date(atOrAfter);
}

export interface IntlDay {
  date: string;
  start: Date;
  nextStart: Date;
}

// Dates whose start or end a DST change can move: the days on either side of
// each offset change in `timeZone` from `fromYear` through `toYear`, plus a
// winter and a summer day so a zone without changes still has cases.
export function listIntlDaysNearOffsetChanges({
  timeZone,
  fromYear,
  toYear,
}: {
  timeZone: string;
  fromYear: number;
  toYear: number;
}): IntlDay[] {
  const offsetFormat = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  });
  const readOffset = (instant: number) =>
    offsetFormat
      .formatToParts(instant)
      .find((part) => part.type === "timeZoneName")?.value;
  const readDate = createDateReader(timeZone);

  const dates = new Set([`${fromYear}-01-15`, `${fromYear}-07-15`]);
  const end = Date.UTC(toYear + 1, 0, 1);
  let previousOffset = readOffset(Date.UTC(fromYear, 0, 1));
  for (let instant = Date.UTC(fromYear, 0, 2); instant < end;) {
    const offset = readOffset(instant);
    if (offset !== previousOffset) {
      // The change happened during the day before `instant`.
      const changeDate = readDate(instant - DAY_MS);
      for (const days of [-1, 0, 1, 2]) {
        dates.add(addDays(changeDate, days));
      }
    }
    previousOffset = offset;
    instant += DAY_MS;
  }

  return [...dates].sort().map((date) => ({
    date,
    start: findIntlDayStart({ date, timeZone }),
    nextStart: findIntlDayStart({ date: addDays(date, 1), timeZone }),
  }));
}
