import { NextResponse } from "next/server";
import { postReminderIfDue } from "@/lib/slack/reminders";

export const runtime = "nodejs";

// Vercel-Cron-only. Vercel sends `Authorization: Bearer <CRON_SECRET>` on
// every cron invocation. We 401 anything else.
//
// The hourly schedule is in vercel.json. The route maps "current London hour"
// to one of {morning, midday, last_call, closed, none} and posts the matching
// reminder. Hours that don't map to a slot are no-ops.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  try {
    const result = await postReminderIfDue();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron:reminders] failed", err);
    const msg = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Vercel Cron sends GET in some configurations; mirror the handler.
export const GET = POST;
