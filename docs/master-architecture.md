# Kudos — Master Architecture

> **Status:** v2 (post-Slack pivot). Supersedes the previous Next.js full-stack scaffold. The web app is now a single read-only copy-to-clipboard surface; all submission lives in Slack.

## 1. Product intent

Kudos is an internal tool for one agency (Shoreditch Design Studio) that captures weekly appreciation in Slack and turns it into a small set of slide images that one operator pastes into Figma at the end of the Thursday meeting.

There is exactly one customer (us), one Slack workspace, one weekly cadence, and one consumer (the meeting operator). The architecture is sized to match.

## 2. Topology

```
┌──────────────────┐                  ┌──────────────────┐
│  Slack workspace │ <── reminders ── │  Vercel Cron     │
│  + Slack app     │ ── interactivity─┤   (3× weekday    │
│                  │ ── slash cmd ────┤    + Thu 16:00)  │
└─────────┬────────┘                  └────────┬─────────┘
          │                                    │
          │         HTTPS (POST)               │
          ▼                                    ▼
┌─────────────────────────────────────────────────────┐
│  Next.js app on Vercel                              │
│                                                     │
│   /                       — copy-page (no auth)     │
│   /api/slack/commands     — slash-command webhook   │
│   /api/slack/interactions — modal submit webhook    │
│   /api/cron/reminders     — Vercel-cron-only        │
│   /api/render/[week]/[i]  — Satori → PNG            │
│                                                     │
│   config/members.ts       — Slack ID → identity     │
│   public/headshots/*.png  — committed to repo       │
└─────────────────────────┬───────────────────────────┘
                          │ SQL
                          ▼
                ┌──────────────────┐
                │ Supabase Postgres│
                │   wins (one tbl) │
                └──────────────────┘
```

Three external systems: Slack (input + reminder distribution), Vercel (hosting + cron), Supabase Postgres (one table). Nothing else.

## 3. What's deliberately *not* here

The previous scaffold had auth, RLS, workspaces, memberships, invites, teams, team_memberships, profiles, digest_runs, digest_slides, publish_targets, admin pages, dashboard, inbox, outbox, sign-in, sign-up, headshot uploader, Figma plugin handoff, ZIP fallback, and a render-and-persist pipeline. **All of it is gone.** The replacements:

| Old | Replaced by |
| --- | --- |
| Supabase Auth + cookie sessions + middleware | Nothing — page is unauthed, URL is the secret |
| `profiles` + `auth.users` | `config/members.ts` (typed Slack ID → identity) |
| `workspaces` + `workspace_memberships` + `workspace_allowed_domains` + `workspace_invites` | Single Slack workspace, implicit |
| `teams` + `team_memberships` | Slack user groups, expanded at submit time |
| RLS policies + helper functions | None (no auth) |
| `weekly_digest_runs` + `weekly_digest_slides` + `digest-slides` storage bucket | On-demand render per request |
| `figma_publish_targets` | Operator pastes into whichever Figma file they have open |
| `/wins/new` + `createWin` server action | Slack slash command + modal submit handler |
| `/dashboard`, `/wins/received`, `/wins/sent`, `/teams`, `/admin/*` | Deleted |

If we ever reintroduce one of these, write a small RFC first — the cost of complexity is what we're rolling back.

## 4. Identity model

A static TypeScript file at `config/members.ts` is the single source of truth for "who is on the team."

```ts
export type Member = {
  slackUserId: string;   // canonical key, e.g. "U01ABC123"
  email: string;         // for record-keeping; not used at runtime
  fullName: string;      // shown on slides
  headshotPath: string;  // e.g. "/headshots/U01ABC123.png", served from /public
};

export const MEMBERS: Member[] = [ /* … hand-edited */ ];
```

Two derived lookups (`MEMBERS_BY_SLACK_ID`, `MEMBERS_BY_EMAIL`) are exported for convenience.

Rules:

- `slackUserId` is the canonical key. Slack returns it from every modal submission and user-group expansion. Email is recorded for human reference but never used to resolve identity at runtime.
- A member who isn't in `members.ts` will appear in slides as their Slack ID. **The Slack bot does not silently drop unknown senders or recipients** — it surfaces a soft warning back into the modal so the operator can update the config and redeploy.
- Headshots are committed to the repo at `public/headshots/<slackUserId>.png`. ~30 PNGs at ~150KB each is fine. Replacing one is a PR.
- Adding/removing a person is a code change + redeploy. This is intentional: the team is small, churn is low, and a config commit is auditable.

## 5. Data model

A single Postgres table:

```sql
create table wins (
  id                  uuid primary key default gen_random_uuid(),
  sender_slack_id     text not null,
  recipient_slack_ids text[] not null check (array_length(recipient_slack_ids, 1) > 0),
  message             text not null check (char_length(btrim(message)) between 1 and 2000),
  week_start_date     date not null,                 -- the Friday of the digest week
  created_at          timestamptz not null default now()
);

create index wins_week_idx on wins (week_start_date);
create index wins_sender_idx on wins (sender_slack_id);
```

That's it. No RLS (the database is reached only from server code holding the service-role key — there is no browser-side Supabase client).

Why an array column instead of a join table:

- Recipients are written once, never edited, and queried as a whole alongside the parent row.
- We don't need per-recipient indexes for v2 (no inbox view, no recipient-level analytics).
- Postgres array semantics are fine for a few hundred rows per year.

If we ever add per-recipient queries, splitting into `wins` + `win_recipients` is a 10-minute migration. Defer.

## 6. The digest week

Identical to v1:

- Week starts **Friday 00:00 Europe/London**.
- Submissions close **Thursday 16:00 Europe/London**.
- `wins.week_start_date` is the Friday of that week, computed at submit time from `created_at` in Europe/London.

The web page's week dropdown shows weeks where the cutoff has passed (`week_start_date + 6 days <= now()` in London time, with the 16:00 boundary). The current in-progress week is hidden until cutoff.

Single source of truth for week math: `lib/week.ts`. Slack handlers and the render route both call it; no other file computes week boundaries.

## 7. Slack bot

### App configuration (one-time, manual in Slack admin)

- Slash command: `/win` → POSTs to `https://<host>/api/slack/commands`.
- Interactivity request URL: `https://<host>/api/slack/interactions`.
- Bot token scopes:
  - `commands` — receive `/win`.
  - `chat:write` — post reminders.
  - `users:read`, `users:read.email` — resolve user metadata if needed.
  - `usergroups:read` — expand user-group mentions at submit time.
- Reminders post to `#uk-office`. The channel ID is in `SLACK_REMINDER_CHANNEL_ID` (env var).

### `/win` flow

1. User runs `/win` in any channel or DM.
2. `/api/slack/commands` verifies the request signature, immediately responds 200 (within 3s — Slack's hard limit), and asynchronously calls `views.open` to push a modal.
3. Modal contains exactly two inputs:
   - `recipients` — `multi_users_select` (Slack's native picker; supports @-mentions of people).
   - `message` — multi-line `plain_text_input`, max 2000 chars.

   *Note:* Slack's modal blocks do not let a single picker mix users + user-groups. To support team mentions, we'd add a second optional `multi_user_groups_select`. v2 ships **users only**; user-group support is a deferred follow-up flagged in `docs/frontend.md` §Backlog.
4. User submits. `/api/slack/interactions` verifies the signature, validates inputs, computes the current `week_start_date` via `lib/week.ts`, deduplicates recipients, removes the sender from the recipient set, and inserts one row into `wins`.
5. Bot responds with an ephemeral confirmation and a `"sent to N people"` summary. If any recipient Slack ID is missing from `config/members.ts`, the confirmation lists them as warnings.

### Reminder flow

`/api/cron/reminders` is hit four times a weekday by Vercel Cron (see §10). Each invocation:

1. Verifies the request came from Vercel Cron (the `Authorization: Bearer $CRON_SECRET` header).
2. Looks at `current time in Europe/London`. Picks the matching reminder template by hour.
3. Calls `chat.postMessage` to `SLACK_REMINDER_CHANNEL_ID` with that template.

Reminder templates (final copy lives in `lib/slack/reminders.ts`):

- **09:00** — "Good morning. Drop your weekly wins with `/win` whenever you have a moment."
- **13:00** — "Reminder — `/win` is open if you've got someone to thank from this week."
- **15:00** — "**Last call** — `/win` closes at 16:00. Get them in."
- **16:00** — "Submissions are closed. Operator can copy this week's slides at `<APP_BASE_URL>`."

The 16:00 message is the *only* one with a link.

### Inbound webhook security

Both `/api/slack/commands` and `/api/slack/interactions` verify the request via Slack's signing-secret HMAC scheme (`X-Slack-Signature` + `X-Slack-Request-Timestamp` ≤ 5 min old, HMAC-SHA256 of `v0:<ts>:<rawBody>` against `SLACK_SIGNING_SECRET`, constant-time compare). The verification helper lives in `lib/slack/verify.ts` and is the **only** way these routes accept a request body.

## 8. Web app

A single page at `/` (un-authed). Documented in detail in `docs/frontend.md`. Summary:

- Week dropdown defaults to "most recent closed week" (i.e. the week whose Thursday 16:00 has just passed).
- Below the dropdown: an ordered list of slide previews for that week (each rendered as a PNG via `<img src="/api/render/<week>/<index>.png">`).
- Each slide has a "Copy slide" button that writes the PNG to the system clipboard via `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`.
- A "Copy all" button copies them in sequence with a 200ms delay (Figma is happy with sequential pastes; the clipboard only holds one image at a time).
- No auth, no toast lib, no router. One client component, one fetch per slide.

The URL is the secret. Defense in depth:

- `<meta name="robots" content="noindex,nofollow">` on `/`.
- `X-Robots-Tag: noindex, nofollow` header from middleware.
- The deployed URL is shared in 1Password / a private channel only.

## 9. Render pipeline

`/api/render/[week]/[index].png` is a server-only route handler that:

1. Parses `week` (`YYYY-MM-DD`) and `index` (integer).
2. Queries `wins` for that `week_start_date`, ordered by `created_at`.
3. Resolves every `sender_slack_id` and every `recipient_slack_ids[*]` against `config/members.ts`. Unknown IDs render with a placeholder name and a generic avatar.
4. Builds the `DigestPayload` (week, recipients-grouped wins, layout class).
5. Calls `renderSlideJsx(payload)[index]` (from `lib/render/layouts.tsx`) → Satori → Resvg → PNG bytes.
6. Returns the PNG with `Cache-Control: public, max-age=300, s-maxage=300` (5 min — re-renders are cheap; we only need to short-circuit the in-meeting click storm).

A companion route `/api/render/[week]/manifest.json` returns `{ slideCount, layoutClass, recipientCount, winsCount }` so the page knows how many `<img>` tags to render without doing the layout calculation client-side.

Why on-demand instead of persisted-on-Thursday-cron:

- Two failure modes collapse into one — if a render is broken, refreshing the page re-runs it. No "regenerate" button, no admin "retry failed run" UI, no `weekly_digest_slides` table to keep in sync.
- Satori is deterministic; the same `wins` rows + same `members.ts` produce the same PNG every time.
- Cache headers handle the in-meeting refresh storm.

Layout classes are unchanged from v1: `solo` (1 recipient), `small` (2–6, 1 slide), `medium` (7–15, 2 slides), `large` (16+, paginated). The selector lives in `lib/render/layout.ts`.

## 10. Cron

`vercel.json` declares four cron entries, all invoking `/api/cron/reminders`. Vercel Cron runs in UTC, so each entry encodes the Europe/London time with the right UTC offset — but BST/GMT switching means we'd need two sets. Simpler approach:

- Schedule **one** cron entry per slot, hourly check, with the route handler doing the actual "is it 09:00 in London right now?" decision. Five-minute window matching avoids dropped runs near DST transitions.

```jsonc
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "0 8-16 * * 1-5" }
  ]
}
```

Runs hourly Mon–Fri 08:00–16:00 UTC. The handler maps "current London hour" to one of `{morning, midday, last_call, closed, none}` and posts (or no-ops). Eight invocations per weekday × 5 weekdays = 40 invocations per week — well under any free-tier limit. The route returns immediately with `{ posted: false }` for hours that don't match a reminder.

`CRON_SECRET` (32+ random bytes) gates the route — Vercel Cron sends it as `Authorization: Bearer …`; any other caller is 401'd.

## 11. Environment variables

```
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Slack
SLACK_SIGNING_SECRET=
SLACK_BOT_TOKEN=
SLACK_REMINDER_CHANNEL_ID=

# App
APP_BASE_URL=
CRON_SECRET=
```

No `NEXT_PUBLIC_*` variables exist in v2. The browser never talks to Supabase or Slack directly; everything is server-rendered or proxied through `/api/*`.

## 12. Deployment

- **Vercel** hosts the Next.js app, the Slack webhooks, and the cron entries. Single project, single deployment.
- **Supabase** hosts the Postgres database. Migration applied via `supabase db push`. No Edge Functions, no Storage, no Auth.
- **Slack** app config is manual one-time setup in the Slack admin UI. Document the URLs and scopes in a `docs/slack-app-setup.md` (TODO).

Promotion path: PR → preview deploy → manual smoke (`/win` in a private test channel + load `/`) → merge → prod.

## 13. Observability

Minimum bar:

- `console.log` from cron and Slack handlers shows up in Vercel logs.
- A failed render returns a structured error PNG (red background, error text) instead of a 500, so the operator at least sees *something* and can alert.
- A `/api/health` route returns `{ db: ok|fail, slack_token_age: <days> }` for spot checks.

If the Thursday 16:00 reminder ever fails to post, that's the canary — the operator notices because they don't get pinged.

## 14. Migration / cutover plan

This is a greenfield rebuild — there is no production v1 in use. The migration path is:

1. Squash all v1 migrations into a single `0001_wins.sql` (this PR).
2. Apply against a new Supabase project (or `supabase db reset` against the existing one — confirm with admin first).
3. Configure the Slack app in the Slack admin and capture the secrets in Vercel env vars.
4. Populate `config/members.ts` from the studio roster.
5. Drop ~30 headshot PNGs into `public/headshots/`.
6. Deploy. First Thursday meeting, the operator opens `/`, picks the week, copies slides into Figma.

## 15. Open assumptions

- **Slack user-group expansion is a v2.1 feature.** The first Thursday ships with `multi_users_select` only.
- **Decorative emojis around headshots (the prior IA's "up to 3") are dropped.** Reintroduce only if the meeting feedback requests it.
- **No edit/delete on submitted wins.** A typo means re-submitting; the operator can ignore the bad row when copying. If this hurts, add a `deleted_at` column and a `/winrm <id>` shortcut later.
- **No analytics.** "Counter for wins sent/received this year" from the v1 IA is not in v2. Reintroduce only on demand.
- **One Slack workspace, one Postgres database, one URL.** No multi-tenant.
