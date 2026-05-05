import "server-only";
import { resolveMember, MEMBERS_BY_SLACK_ID } from "@/config/members";
import { getWeekWins } from "@/lib/wins";
import { weekEndDate } from "@/lib/week";
import {
  isEveryoneRecipientList,
  pickVariant,
  type WeekPayload,
  type WinSlide,
} from "./layout";

/**
 * Build the week payload — one slide per win, ordered by created_at asc
 * (chronological, the natural meeting order).
 */
export async function buildWeekPayload(weekStartDate: string): Promise<WeekPayload> {
  const wins = await getWeekWins(weekStartDate);
  const slides: WinSlide[] = wins.map(toSlide);
  return {
    weekStartDate,
    weekEndDate: weekEndDate(weekStartDate),
    slides,
  };
}

function toSlide(row: {
  id: string;
  sender_slack_id: string;
  recipient_slack_ids: string[];
  message: string;
  created_at: string;
}): WinSlide {
  const isEveryone = isEveryoneRecipientList(row.recipient_slack_ids);
  const senderMember = resolveMember(row.sender_slack_id);

  const visibleRecipients = isEveryone
    ? []
    : row.recipient_slack_ids.slice(0, 6).map((id) => {
        const m = resolveMember(id);
        return {
          slackUserId: m.slackUserId,
          fullName: m.fullName,
          headshotPath: m.headshotPath,
        };
      });

  const overflowCount = isEveryone
    ? 0
    : Math.max(0, row.recipient_slack_ids.length - 6);

  const variant = pickVariant({
    recipientCount: row.recipient_slack_ids.length,
    isEveryone,
  });

  return {
    winId: row.id,
    createdAt: row.created_at,
    variant,
    isEveryone,
    recipients: visibleRecipients,
    overflowCount,
    message: row.message,
    sender: {
      slackUserId: senderMember.slackUserId,
      fullName: senderMember.fullName,
      headshotPath: senderMember.headshotPath,
    },
  };
}

/**
 * Diagnostic: list Slack IDs in the week's wins that don't have a roster
 * entry. Surfaced in the admin/health view if we add one.
 */
export async function unknownSlackIdsForWeek(weekStartDate: string): Promise<string[]> {
  const wins = await getWeekWins(weekStartDate);
  const out = new Set<string>();
  for (const w of wins) {
    if (!MEMBERS_BY_SLACK_ID[w.sender_slack_id]) {
      out.add(w.sender_slack_id);
    }
    if (!isEveryoneRecipientList(w.recipient_slack_ids)) {
      for (const id of w.recipient_slack_ids) {
        if (!MEMBERS_BY_SLACK_ID[id]) out.add(id);
      }
    }
  }
  return Array.from(out);
}
