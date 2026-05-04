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

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  _client = createSupabaseClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return _client;
}
