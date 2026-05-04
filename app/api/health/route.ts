import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  try {
    const { error } = await db().from("wins").select("id").limit(1);
    dbOk = !error;
  } catch {
    dbOk = false;
  }

  const slackTokenSet = Boolean(process.env.SLACK_BOT_TOKEN);
  const reminderChannelSet = Boolean(process.env.SLACK_REMINDER_CHANNEL_ID);

  return NextResponse.json({
    db: dbOk ? "ok" : "fail",
    slack_token_set: slackTokenSet,
    reminder_channel_set: reminderChannelSet,
    now: new Date().toISOString(),
  });
}
