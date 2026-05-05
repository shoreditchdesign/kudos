import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase client. v2 has no auth, no RLS, and no
// browser-side Supabase client — every database access goes through
// this one helper from server code on Vercel.
//
// Never import this file from a "use client" module. The "server-only"
// import above will fail the build if that ever happens.

export type WinsTable = {
  Row: {
    id: string;
    sender_slack_id: string;
    recipient_slack_ids: string[];
    message: string;
    week_start_date: string;
    created_at: string;
  };
  Insert: {
    id?: string;
    sender_slack_id: string;
    recipient_slack_ids: string[];
    message: string;
    week_start_date: string;
    created_at?: string;
  };
  Update: Partial<WinsTable["Insert"]>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      wins: WinsTable;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let _client: SupabaseClient<Database> | null = null;

export function db(): SupabaseClient<Database> {
  if (_client) return _client;

  if (typeof window !== "undefined") {
    throw new Error("db() must not be called in a browser context");
  }

  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !key) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  // supabase-js appends `/rest/v1/...` to whatever URL we pass. If the env
  // var has a trailing slash or path segment, the final URL becomes
  // `//rest/v1/...` or `…/rest/v1/rest/v1/...` and PostgREST rejects with
  // PGRST125. Normalize defensively: keep only `https://<host>`.
  const url = (() => {
    try {
      const u = new URL(rawUrl);
      return `${u.protocol}//${u.host}`;
    } catch {
      return rawUrl.replace(/\/+$/, "");
    }
  })();

  _client = createSupabaseClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return _client;
}
