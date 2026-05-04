import { NextResponse } from "next/server";
import { scheduleThursdayReminders } from "@/lib/slack/reminders";

export const runtime = "nodejs";

// Called once a week by GitHub Actions (Thursday morning UTC). Schedules
// all four Thursday reminders via Slack's chat.scheduleMessage API and
// returns the resulting message IDs. Idempotent — re-running on the same
// day clears the previous batch and re-queues a fresh one.
//
// Bearer-protected via CRON_SECRET so only the GitHub Action (or someone
// with the secret) can hit it.
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

  try {
    const result = await scheduleThursdayReminders({ channel, appBaseUrl });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron:schedule-week] failed", err);
    const msg = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Manual GET for dry-run / smoke test from a browser. Same auth.
export const GET = POST;
