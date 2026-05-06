import "server-only";
import { db } from "./db";
import {
  allWeekStartsSince,
  currentWeekStart,
  formatWeekLabel,
  isWeekClosed,
  weekEndDate,
} from "./week";
import { EVERYONE_SENTINEL } from "@/config/members";

/**
 * Maximum message length. Capped at the longest text that fits the slide's
 * quote block in Cabinet Grotesk Bold 64px. The DB CHECK constraint must
 * match.
 *
 * Update this value in two places when you change the cap:
 *   1. here (validation + Slack modal),
 *   2. supabase/migrations/0002_message_length_cap.sql (DB constraint).
 */
export const MESSAGE_MAX = 320;

export type WinRow = {
  id: string;
  sender_slack_id: string;
  recipient_slack_ids: string[];
  message: string;
  week_start_date: string; // YYYY-MM-DD
  created_at: string;
};

export type WeekStatus = "closed" | "in_progress";

export type WeekListItem = {
  weekStartDate: string;
  weekEndDate: string;
  label: string;
  status: WeekStatus;
};

/**
 * Insert a single win. Called from the Slack modal-submit handler.
 *
 * Inputs are pre-validated by the caller (signature verified, message length
 * checked). We dedupe recipients here and remove the sender from their own
 * recipient list as a defensive last step.
 *
 * When `isEveryone` is true, the win is stored with the @everyone sentinel
 * as the sole recipient — the renderer detects this and swaps in the
 * everyone.png gallery image.
 */
export async function insertWin(input: {
  senderSlackId: string;
  recipientSlackIds: string[];
  message: string;
  isEveryone?: boolean;
}): Promise<{ id: string }> {
  const message = input.message.trim();
  if (!message) throw new Error("message is required");
  if (message.length > MESSAGE_MAX) {
    throw new Error(`message exceeds ${MESSAGE_MAX} characters`);
  }

  let recipients: string[];
  if (input.isEveryone) {
    recipients = [EVERYONE_SENTINEL];
  } else {
    recipients = Array.from(new Set(input.recipientSlackIds))
      .filter((id) => id && id !== input.senderSlackId);
    if (recipients.length === 0) {
      throw new Error("at least one recipient is required");
    }
  }

  const weekStartDate = currentWeekStart();

  const { data, error } = await db()
    .from("wins")
    .insert({
      sender_slack_id: input.senderSlackId,
      recipient_slack_ids: recipients,
      message,
      week_start_date: weekStartDate,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`insertWin failed: ${error?.message ?? "no row returned"}`);
  }
  return { id: data.id as string };
}

/**
 * All wins for a closed week, ordered by created_at. Used by the render
 * route to build the week payload.
 */
export async function getWeekWins(weekStartDate: string): Promise<WinRow[]> {
  const { data, error } = await db()
    .from("wins")
    .select("*")
    .eq("week_start_date", weekStartDate)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`getWeekWins failed: ${error.message}`);
  return (data ?? []) as WinRow[];
}

/**
 * Every Friday since the project's start (2026-01-02), most recent first.
 * Each entry is annotated with its status — `closed` if the Thursday 12:00
 * cutoff has passed, `in_progress` otherwise.
 *
 * The dropdown shows all weeks (including empty ones) so the operator can
 * test empty/locked states. The page filters its display by status.
 */
export async function listClosedWeeks(limit = 30): Promise<WeekListItem[]> {
  const all = allWeekStartsSince();
  return all
    .reverse()
    .slice(0, limit)
    .map((d) => ({
      weekStartDate: d,
      weekEndDate: weekEndDate(d),
      label: formatWeekLabel(d),
      status: isWeekClosed(d) ? ("closed" as const) : ("in_progress" as const),
    }));
}
