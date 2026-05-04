-- 0001_wins.sql
-- v2 schema. The previous v1 migrations (workspaces, profiles, memberships,
-- teams, RLS, digest_runs, digest_slides, figma_publish_targets) are deleted —
-- v2 is a single-tenant internal tool with no auth, no RLS, and no per-user
-- visibility model. The database is reached only by server code holding
-- SUPABASE_SERVICE_ROLE_KEY.
--
-- Apply via: supabase db push (after `supabase link`).

create extension if not exists "pgcrypto";

create table if not exists wins (
  id                  uuid primary key default gen_random_uuid(),
  sender_slack_id     text not null,
  recipient_slack_ids text[] not null,
  message             text not null,
  week_start_date     date not null,
  created_at          timestamptz not null default now(),

  constraint wins_recipients_nonempty
    check (array_length(recipient_slack_ids, 1) > 0),

  constraint wins_message_length
    check (char_length(btrim(message)) between 1 and 2000)
);

create index if not exists wins_week_idx     on wins (week_start_date);
create index if not exists wins_sender_idx   on wins (sender_slack_id);

-- RLS is intentionally NOT enabled. The only client of this database is the
-- Next.js app on Vercel using the service role; the browser never connects
-- directly. If we ever expose this table to anon traffic, enable RLS and add
-- explicit policies — do not rely on the obscure URL alone.
