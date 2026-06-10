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
 * 12:00 cutoff has passed. This is what the operator-facing dropdown caps at
 * — submissions can still come in until the 16:00 reminder, but the page
 * makes the week visible from noon so the operator can preview.
 *
 * Logic:
 *   - if it's currently after Thursday 12:00 in London, the *current* week is
 *     closed and is therefore the most recent closed week.
 *   - otherwise, the previous week is.
 */
export function currentClosedWeekStart(now: Date = new Date()): string {
  const parts = getLondonParts(now);
  const isPastCutoff = parts.weekday === "Thursday" && parts.hour >= 12;

  const cur = currentWeekStart(now);
  return isPastCutoff ? cur : shiftYmd(cur, -7);
}

/**
 * The first Friday in 2026 — used as the floor for the dropdown's week list.
 * Anything earlier is below the project's start date and won't appear.
 */
export const FIRST_FRIDAY_OF_2026 = "2026-01-02";

/**
 * Generate all Fridays from `start` up to and including the current week's
 * Friday (whether that week is closed or still in progress). Used to populate
 * the dropdown with every week — empty or full — since the project began.
 */
export function allWeekStartsSince(
  start: string = FIRST_FRIDAY_OF_2026,
  now: Date = new Date(),
): string[] {
  const cap = currentWeekStart(now);
  const out: string[] = [];
  let cursor = start;
  while (cursor <= cap) {
    out.push(cursor);
    cursor = shiftYmd(cursor, 7);
  }
  return out;
}

/**
 * True when the given Friday is at or before the most-recent-closed-week
 * Friday (i.e. its Thursday 12:00 cutoff has passed). False for the current
 * in-progress week.
 */
export function isWeekClosed(weekStartDate: string, now: Date = new Date()): boolean {
  return weekStartDate <= currentClosedWeekStart(now);
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
 * Reminder slots for the Thursday cadence. The actual posting times in
 * London are:
 *   09:00 morning   — first call for the week's wins
 *   12:00 midday    — second call
 *   15:00 last_call — third call
 *   16:00 closed    — submissions closed, includes link to the copy page
 *
 * The GitHub Action fires once a week and calls /api/cron/schedule-week,
 * which uses Slack's chat.scheduleMessage to queue all four reminders for
 * delivery at the exact London times below — no per-slot cron needed.
 */
export type ReminderSlot = "morning" | "midday" | "last_call" | "closed";

export const REMINDER_HOURS_LONDON: Record<ReminderSlot, number> = {
  morning: 9,
  midday: 12,
  last_call: 15,
  closed: 16,
};

/**
 * Given any moment, return the next Thursday's date in London. If `now` is
 * itself Thursday and the time is before the last reminder (16:00), today
 * is returned. After Thursday 17:00 London, advance to next week.
 */
function nextThursdayLondon(now: Date): { year: number; month: number; day: number } {
  const parts = getLondonParts(now);

  const WEEKDAY_NUMBER: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };
  const today = WEEKDAY_NUMBER[parts.weekday] ?? 0;

  let daysUntil = (4 - today + 7) % 7; // 4 = Thursday
  if (daysUntil === 0 && parts.hour >= 16) {
    daysUntil = 7; // already at/past today's last reminder (16:00), go to next week
  }

  const anchor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + daysUntil);
  const result = getLondonParts(anchor);
  return { year: result.year, month: result.month, day: result.day };
}

/**
 * London IANA offset in minutes for a given UTC reference moment. Returns
 * +60 in BST and 0 in GMT. Uses Intl's longOffset format ("GMT+01:00")
 * which is robust across DST transitions.
 */
function londonOffsetMinutes(referenceUtc: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: WORKSPACE_TIMEZONE,
    timeZoneName: "longOffset",
  });
  const offsetStr = formatter
    .formatToParts(referenceUtc)
    .find((p) => p.type === "timeZoneName")?.value;
  if (!offsetStr) return 0;
  const m = offsetStr.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const sign = m[1] === "+" ? 1 : -1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * Unix epoch (seconds) for a London wall-clock time on a given date.
 * Handles BST/GMT transparently.
 */
function londonEpochSeconds(
  year: number,
  month: number,
  day: number,
  hour: number,
): number {
  const reference = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offsetMin = londonOffsetMinutes(reference);
  const utcMs = Date.UTC(year, month - 1, day, hour, 0, 0) - offsetMin * 60_000;
  return Math.floor(utcMs / 1000);
}

/**
 * Compute unix epoch (seconds) for each of Thursday's four reminder slots,
 * relative to `now`. Used by the schedule-week endpoint to pass `post_at`
 * to Slack's chat.scheduleMessage.
 */
export function thursdayTimestamps(
  now: Date = new Date(),
): Record<ReminderSlot, number> {
  const { year, month, day } = nextThursdayLondon(now);
  const out = {} as Record<ReminderSlot, number>;
  for (const slot of Object.keys(REMINDER_HOURS_LONDON) as ReminderSlot[]) {
    out[slot] = londonEpochSeconds(year, month, day, REMINDER_HOURS_LONDON[slot]);
  }
  return out;
}
