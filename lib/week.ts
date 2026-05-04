// Single source of truth for digest week math.
//
// Week boundaries:
//   start: Friday 00:00:00 Europe/London
//   end:   Thursday 16:00:00 Europe/London (cutoff — submissions close here)
//
// `wins.week_start_date` is the Friday of the digest week as YYYY-MM-DD.

const WORKSPACE_TIMEZONE = "Europe/London";

const PARTS_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: WORKSPACE_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type LondonParts = {
  year: number;
  month: number;
  day: number;
  weekday: string;
  hour: number;
  minute: number;
};

function getLondonParts(d: Date): LondonParts {
  const lookup: Record<string, string> = {};
  for (const p of PARTS_FORMATTER.formatToParts(d)) lookup[p.type] = p.value;
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    weekday: lookup.weekday ?? "",
    hour: Number(lookup.hour ?? 0),
    minute: Number(lookup.minute ?? 0),
  };
}

const DAYS_SINCE_FRIDAY: Record<string, number> = {
  Friday: 0,
  Saturday: 1,
  Sunday: 2,
  Monday: 3,
  Tuesday: 4,
  Wednesday: 5,
  Thursday: 6,
};

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftYmd(start: string, deltaDays: number): string {
  // Anchor at noon UTC to keep simple ±day arithmetic safe across DST.
  const [y, m, d] = start.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/**
 * The Friday (YYYY-MM-DD) that begins the digest week containing `now`.
 *
 * Note: this returns the *current* week's Friday regardless of whether the
 * cutoff has passed. Use `currentClosedWeekStart()` if you want to filter to
 * weeks the operator can actually copy.
 */
export function currentWeekStart(now: Date = new Date()): string {
  const parts = getLondonParts(now);
  const delta = DAYS_SINCE_FRIDAY[parts.weekday] ?? 0;
  return shiftYmd(ymd(parts.year, parts.month, parts.day), -delta);
}

/**
 * The Friday (YYYY-MM-DD) that begins the most recent week whose Thursday
 * 16:00 cutoff has passed. This is what the operator-facing dropdown caps at.
 *
 * Logic:
 *   - if it's currently after Thursday 16:00 in London, the *current* week is
 *     closed and is therefore the most recent closed week.
 *   - otherwise, the previous week is.
 */
export function currentClosedWeekStart(now: Date = new Date()): string {
  const parts = getLondonParts(now);
  const isPastCutoff = parts.weekday === "Thursday" && parts.hour >= 16;

  // The Thursday end of the current digest week (which started on a Friday).
  // If today is Thursday and we're past cutoff, "current week" is closed.
  // Otherwise we step back one full week.
  const cur = currentWeekStart(now);
  return isPastCutoff ? cur : shiftYmd(cur, -7);
}

/**
 * The Thursday (YYYY-MM-DD) that ends the digest week starting on the given
 * Friday. Used for display labels only.
 */
export function weekEndDate(weekStartDate: string): string {
  return shiftYmd(weekStartDate, 6);
}

/**
 * Human label for a week, e.g. "25 Apr – 1 May 2026".
 */
export function formatWeekLabel(weekStartDate: string): string {
  const end = weekEndDate(weekStartDate);
  const start = weekStartDate;

  const fmt = (iso: string, full: boolean) => {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: full ? "numeric" : undefined,
      timeZone: "UTC",
    }).format(dt);
  };

  return `${fmt(start, false)} – ${fmt(end, true)}`;
}

/**
 * Which reminder slot (if any) corresponds to the current London hour. Used
 * by /api/cron/reminders to decide what to post. Returns null when the
 * hourly cron tick lands outside the four reminder slots.
 */
export type ReminderSlot = "morning" | "midday" | "last_call" | "closed";

export function reminderSlotForNow(now: Date = new Date()): ReminderSlot | null {
  const parts = getLondonParts(now);
  // Reminders only run Mon–Fri.
  if (parts.weekday === "Saturday" || parts.weekday === "Sunday") return null;
  if (parts.hour === 9) return "morning";
  if (parts.hour === 13) return "midday";
  if (parts.hour === 15) return "last_call";
  // The 16:00 "closed" message only fires on Thursday.
  if (parts.hour === 16 && parts.weekday === "Thursday") return "closed";
  return null;
}
