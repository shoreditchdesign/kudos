import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const dbResult = await checkDb();

  return NextResponse.json({
    db: dbResult.ok ? "ok" : "fail",
    db_error: dbResult.ok ? undefined : dbResult.error,
    db_url_set: Boolean(process.env.SUPABASE_URL),
    db_url_host: process.env.SUPABASE_URL
      ? safeHost(process.env.SUPABASE_URL)
      : undefined,
    db_service_key_set: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    db_service_key_prefix: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 4)}…(${process.env.SUPABASE_SERVICE_ROLE_KEY.length} chars)`
      : undefined,
    slack_token_set: Boolean(process.env.SLACK_BOT_TOKEN),
    reminder_channel_set: Boolean(process.env.SLACK_REMINDER_CHANNEL_ID),
    app_base_url: process.env.APP_BASE_URL ?? null,
    now: new Date().toISOString(),
  });
}

async function checkDb(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await db().from("wins").select("id").limit(1);
    if (error) return { ok: false, error: `${error.code ?? ""} ${error.message}`.trim() };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid URL)";
  }
}
