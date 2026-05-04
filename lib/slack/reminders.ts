import "server-only";
import { slack } from "./client";
import { reminderSlotForNow, type ReminderSlot } from "../week";

// Reminder copy. Final copy can be tweaked by editing this map; the slot keys
// are defined in lib/week.ts.

const REMINDERS: Record<ReminderSlot, (appBaseUrl: string) => string> = {
  morning: () =>
    "Good morning. Drop your weekly wins with `/win` whenever you have a moment.",
  midday: () =>
    "Reminder — `/win` is open if you've got someone to thank from this week.",
  last_call: () =>
    "*Last call* — `/win` closes at 16:00. Get them in.",
  closed: (appBaseUrl: string) =>
    `Submissions are closed. Operator can copy this week's slides at ${appBaseUrl}.`,
};

/**
 * Idempotent-on-skip: if the current London time doesn't match a reminder
 * slot, this no-ops. The cron route calls this on every hourly tick.
 */
export async function postReminderIfDue(now: Date = new Date()): Promise<{
  posted: boolean;
  slot: ReminderSlot | null;
}> {
  const slot = reminderSlotForNow(now);
  if (!slot) return { posted: false, slot: null };

  const channel = process.env.SLACK_REMINDER_CHANNEL_ID;
  if (!channel) {
    throw new Error("SLACK_REMINDER_CHANNEL_ID is not set");
  }

  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  const text = REMINDERS[slot](appBaseUrl);

  await slack().chat.postMessage({
    channel,
    text,
    // mrkdwn enables *bold* — Slack's mrkdwn dialect, not standard markdown.
    mrkdwn: true,
  });

  return { posted: true, slot };
}
