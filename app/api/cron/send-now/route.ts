import { NextResponse } from "next/server";
import { postReminderNow } from "@/lib/slack/reminders";
import type { ReminderSlot } from "@/lib/week";

export const runtime = "nodejs";

const VALID_SLOTS: ReadonlySet<ReminderSlot> = new Set([
  "morning",
  "midday",
  "last_call",
  "closed",
]);

// Manual one-shot send: posts the chosen reminder slot's message to
// #uk-office immediately, no scheduling. Triggered by the "Send Bot in
// Channel" GitHub workflow for testing.
//
// Bearer-protected via CRON_SECRET. Slot is passed as a query string
// (?slot=morning|midday|last_call|closed). Defaults to `morning`.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const channel = process.env.SLACK_REMINDER_CHANNEL_ID;
  if (!channel) {
    return NextResponse.json(
      { error: "SLACK_REMINDER_CHANNEL_ID not set" },
      { status: 500 },
    );
  }

  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  if (!appBaseUrl) {
    return NextResponse.json(
      { error: "APP_BASE_URL not set" },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const slotParam = (url.searchParams.get("slot") ?? "morning") as ReminderSlot;
  if (!VALID_SLOTS.has(slotParam)) {
    return NextResponse.json(
      {
        error: `unknown slot '${slotParam}'`,
        validSlots: Array.from(VALID_SLOTS),
      },
      { status: 400 },
    );
  }

  try {
    const result = await postReminderNow({ slot: slotParam, channel, appBaseUrl });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, slot: slotParam, ts: result.ts });
  } catch (err) {
    console.error("[cron:send-now] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}

// GET mirrors POST so the GitHub Action can use either method.
export const GET = POST;
