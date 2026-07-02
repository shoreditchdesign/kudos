import "server-only";
import { slack } from "./client";
import {
  REMINDER_HOURS_LONDON,
  thursdayTimestamps,
  type ReminderSlot,
} from "../week";

// Reminder copy. Format mirrors the Snack-Shack-style template:
//   line 1: emoji + bold headline
//   line 2: body sentence
//   actions row: primary button (where it makes sense)
//   context row: small italic helper text
//
// Each function returns a payload Slack accepts (text fallback + blocks).

type ReminderPayload = {
  text: string;
  blocks: Array<Record<string, unknown>>;
};

const ACTION_OPEN_WIN_MODAL = "open_win_modal";

function morning(): ReminderPayload {
  return {
    text: "It's win time. Drop a kudo with /kudos whenever you have a moment.",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            ":sparkles: *It's win time.*\n" +
            "What's a teammate done well this week? Tap below or run `/kudos`.",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Send a win", emoji: true },
            style: "primary",
            action_id: ACTION_OPEN_WIN_MODAL,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "_Submissions close today at *4pm*_",
          },
        ],
      },
    ],
  };
}

function midday(): ReminderPayload {
  return {
    text: "Halfway there — /kudos is still open.",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            ":eyes: *Halfway through the day.*\n" +
            "Got someone to thank from this week? `/kudos` is still open.",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Send a win", emoji: true },
            style: "primary",
            action_id: ACTION_OPEN_WIN_MODAL,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "_Closes today at *4pm*_",
          },
        ],
      },
    ],
  };
}

function lastCall(): ReminderPayload {
  return {
    text: "Last call. /kudos closes in one hour.",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            ":hourglass_flowing_sand: *Last call.*\n" +
            "`/kudos` closes in *one hour*. Get them in before 4pm.",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Send a win", emoji: true },
            style: "primary",
            action_id: ACTION_OPEN_WIN_MODAL,
          },
        ],
      },
    ],
  };
}

function closed(): ReminderPayload {
  return {
    text: "This week's wins are in.",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            ":tada: *This week's wins are in.*\n" +
            "Wins closed for this week. See you at End of Week!",
        },
      },
    ],
  };
}

const REMINDERS: Record<ReminderSlot, (appBaseUrl: string) => ReminderPayload> = {
  morning: () => morning(),
  midday: () => midday(),
  last_call: () => lastCall(),
  closed: () => closed(),
};

/**
 * Build the Slack message payload for a single reminder slot. Used both by
 * the scheduler and by the immediate-send endpoint.
 */
export function getReminderPayload(
  slot: ReminderSlot,
  appBaseUrl: string,
): ReminderPayload {
  return REMINDERS[slot](appBaseUrl);
}

/**
 * Post a reminder slot's message immediately (no scheduling). Used by the
 * "Send Bot in Channel" GitHub workflow for testing or one-off broadcasts.
 */
export async function postReminderNow(input: {
  slot: ReminderSlot;
  channel: string;
  appBaseUrl: string;
}): Promise<{ ok: true; ts: string } | { ok: false; error: string }> {
  const payload = REMINDERS[input.slot](input.appBaseUrl);
  const res = await slack().chat.postMessage({
    channel: input.channel,
    text: payload.text,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blocks: payload.blocks as any,
  });
  if (!res.ok || !res.ts) {
    return { ok: false, error: res.error ?? "unknown" };
  }
  return { ok: true, ts: res.ts };
}

/**
 * Idempotently schedule all four Thursday reminders via Slack's
 * chat.scheduleMessage. Called from /api/cron/schedule-week, which is
 * triggered by GitHub Actions weekly.
 *
 * "Idempotent" means: re-running on the same day does not produce
 * duplicates. Before scheduling, any of the bot's pre-existing scheduled
 * messages in the same channel whose `post_at` falls on the upcoming
 * Thursday are deleted. So a re-run replaces the queued batch with a fresh
 * one.
 */
export async function scheduleThursdayReminders(input: {
  now?: Date;
  channel: string;
  appBaseUrl: string;
}): Promise<{
  scheduled: Array<{ slot: ReminderSlot; postAt: number; messageId: string }>;
  skipped: Array<{ slot: ReminderSlot; postAt: number }>;
  cancelledExisting: number;
}> {
  const now = input.now ?? new Date();
  const timestamps = thursdayTimestamps(now);

  // Window for clearing existing scheduled messages: from the morning slot
  // to the closed slot (inclusive), plus a 1-min buffer either side.
  const windowStart = timestamps.morning - 60;
  const windowEnd = timestamps.closed + 60;

  const cancelledExisting = await clearExistingInWindow({
    channel: input.channel,
    windowStart,
    windowEnd,
  });

  const scheduled: Array<{
    slot: ReminderSlot;
    postAt: number;
    messageId: string;
  }> = [];
  const skipped: Array<{ slot: ReminderSlot; postAt: number }> = [];

  // Slack rejects any post_at in the past with `time_in_past`. If this runs
  // late (a delayed GitHub Action, or a same-day manual re-run), some slots
  // may already have passed — skip those rather than throwing, so the
  // remaining slots still get queued.
  const nowSec = Math.floor(now.getTime() / 1000);

  for (const slot of Object.keys(REMINDER_HOURS_LONDON) as ReminderSlot[]) {
    if (timestamps[slot] <= nowSec) {
      skipped.push({ slot, postAt: timestamps[slot] });
      continue;
    }
    const payload = REMINDERS[slot](input.appBaseUrl);
    const res = await slack().chat.scheduleMessage({
      channel: input.channel,
      post_at: timestamps[slot],
      text: payload.text,
      // The Slack TS bindings type `blocks` strictly via @slack/types; our
      // blocks are correct Block Kit JSON but constructed as plain objects.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blocks: payload.blocks as any,
    });
    if (!res.ok || !res.scheduled_message_id) {
      throw new Error(`scheduleMessage failed for ${slot}: ${res.error ?? "unknown"}`);
    }
    scheduled.push({
      slot,
      postAt: timestamps[slot],
      messageId: res.scheduled_message_id,
    });
  }

  return { scheduled, skipped, cancelledExisting };
}

async function clearExistingInWindow(input: {
  channel: string;
  windowStart: number;
  windowEnd: number;
}): Promise<number> {
  let cursor: string | undefined;
  let cancelled = 0;

  do {
    const res = await slack().chat.scheduledMessages.list({
      channel: input.channel,
      limit: 100,
      cursor,
    });
    if (!res.ok) break;

    for (const m of res.scheduled_messages ?? []) {
      const postAt = m.post_at;
      if (
        m.id &&
        typeof postAt === "number" &&
        postAt >= input.windowStart &&
        postAt <= input.windowEnd
      ) {
        await slack().chat.deleteScheduledMessage({
          channel: input.channel,
          scheduled_message_id: m.id,
        });
        cancelled += 1;
      }
    }

    cursor = res.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return cancelled;
}

// Exported for the interactivity handler so the "Send a win" button can
// route correctly without re-importing the action_id constant string.
export const REMINDER_ACTION_IDS = {
  openWinModal: ACTION_OPEN_WIN_MODAL,
} as const;
