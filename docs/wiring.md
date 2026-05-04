# Wiring guide — Supabase + Slack + Vercel

This walks through getting the three external systems connected so we can test end-to-end. Order matters: do them in the sequence below. Each step ends with a value you'll paste into `.env.local` (or Vercel env vars later).

After this is done, what you'll have:

- A live Postgres database with the `wins` table.
- A Slack app installed in the workspace with a `/win` slash command and a modal that writes to that DB.
- Reminder posts to `#uk-office` from a cron job.
- A deployed copy page at a Vercel URL.

There's no "shared secrets" file in this repo — everything is read from environment variables at runtime.

---

## 1. Supabase

### 1a. Create the project

1. Go to https://supabase.com/dashboard, click **New project**.
2. Name it `kudos` (or whatever — we never reference the name in code).
3. Pick a region close to London (`eu-west-1` or `eu-west-2`). Doesn't have to be perfect; the DB only sees a few writes a week.
4. Generate a strong DB password and stash it somewhere safe (you won't need it after this; the service-role key is what we use). Click **Create new project** and wait ~2 minutes for it to provision.

### 1b. Apply the migration

In the Supabase dashboard:

1. Open the project.
2. Go to **SQL Editor** in the left nav.
3. Click **New query**.
4. Paste the contents of `supabase/migrations/0001_wins.sql` from this repo.
5. Click **Run**. You should see `Success. No rows returned`.

You can verify by going to **Table Editor** in the left nav — there'll be one table called `wins` with five columns and zero rows.

### 1c. Capture the env vars

Still in the dashboard:

1. Go to **Project Settings** (gear icon, bottom left) → **Data API**.
2. Copy the **Project URL** (looks like `https://xxxxxxxxxxx.supabase.co`). Paste it as `SUPABASE_URL` in your `.env.local`.
3. Go to **Project Settings** → **API Keys**.
4. Reveal the **`service_role` secret key** (NOT the `anon` key — we don't use that). Paste it as `SUPABASE_SERVICE_ROLE_KEY`.

⚠️ The `service_role` key bypasses Row Level Security. It must never go anywhere a browser can read it. The repo's `lib/db.ts` has a runtime guard that throws if it's accessed in a browser context, but treat it like a password regardless.

---

## 2. Slack app

### 2a. Create the app

1. Go to https://api.slack.com/apps and click **Create New App** → **From scratch**.
2. Name: `Kudos` (or `Weekly Wins` if you prefer). Pick the Shoreditch Design Studio workspace.
3. You'll land on the app's **Basic Information** page — keep this tab open, we come back to it.

### 2b. Configure scopes (what the bot is allowed to do)

In the left nav: **OAuth & Permissions** → scroll to **Bot Token Scopes** → **Add an OAuth Scope** for each of these:

- `commands` — to receive `/win`.
- `chat:write` — to post reminders into `#uk-office`.
- `chat:write.public` — so the bot can post into `#uk-office` without being explicitly added (saves a step).
- `users:read` — to resolve user info if needed.
- `usergroups:read` — reserved for future user-group expansion (deferred per master-architecture §15).

You don't need any **User Token Scopes**.

### 2c. Add the slash command

In the left nav: **Slash Commands** → **Create New Command**:

- Command: `/win`
- Request URL: `https://<your-vercel-url>/api/slack/commands` (you'll have this after step 4 below — for now leave a placeholder, we come back).
- Short description: `Send a weekly win`
- Usage hint: leave blank
- ✅ tick **Escape channels, users, and links sent to your app**

Save.

### 2d. Enable interactivity (so modals work)

In the left nav: **Interactivity & Shortcuts** → toggle **Interactivity** on:

- Request URL: `https://<your-vercel-url>/api/slack/interactions` (placeholder for now).

Save.

### 2e. Install the app

In the left nav: **Install App** → click **Install to Workspace** → review the permissions → **Allow**.

You'll be redirected back to the **Install App** page with a **Bot User OAuth Token** (starts with `xoxb-`). Copy it as `SLACK_BOT_TOKEN` in your `.env.local`.

### 2f. Capture the signing secret

Back to **Basic Information** in the left nav. Scroll down to **App Credentials** → **Signing Secret** → click **Show** → copy. Paste as `SLACK_SIGNING_SECRET`.

### 2g. Capture the reminder channel ID

In Slack itself:

1. Right-click `#uk-office` in the channel list → **View channel details** → scroll to the very bottom → there's a **Channel ID** like `C01ABC234`.
2. Copy and paste as `SLACK_REMINDER_CHANNEL_ID` in `.env.local`.

(Alternative: if you have the channel open, the URL bar shows `/archives/C01ABC234`.)

### 2h. Add the bot to the channel

In Slack: open `#uk-office` → type `/invite @Kudos` (or whatever you named the app) → enter. The bot is now a member; reminders will post.

---

## 3. Generate a `CRON_SECRET`

This is just a random 32-byte hex string used by Vercel Cron to authenticate to itself.

```bash
openssl rand -hex 32
```

Copy the output and paste as `CRON_SECRET` in `.env.local`.

---

## 4. GitHub Actions (weekly schedule trigger)

Vercel Hobby cron only runs once per day per job, which doesn't fit our four-times-on-Thursday schedule. Instead we use **GitHub Actions** to fire once a week — the workflow calls the app's `/api/cron/schedule-week` endpoint, which uses Slack's `chat.scheduleMessage` API to queue all four reminders for delivery at the exact London times. Slack itself handles the timing; we just need one weekly trigger.

The workflow file lives at `.github/workflows/reminders.yml` (already in the repo). It fires every Thursday at 06:00 UTC.

You need to add **two repository secrets** in GitHub:

1. Open your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Add `APP_BASE_URL` with your Vercel deploy URL (e.g. `https://kudos-abc123.vercel.app`, no trailing slash).
3. Add `CRON_SECRET` with the same value you set in Vercel's env vars.

That's it. The first scheduled run fires next Thursday at 06:00 UTC.

### Manual smoke test

Once both secrets are set, you can trigger the workflow on demand without waiting for Thursday:

1. Open the **Actions** tab in your GitHub repo.
2. Pick **Schedule Thursday reminders** in the left sidebar.
3. Click **Run workflow** → **Run workflow**.

Expected: the run completes in ~10 seconds and the response body is a JSON like:

```json
{
  "scheduled": [
    { "slot": "morning",   "postAt": 1746086400, "messageId": "Q01ABC234" },
    { "slot": "midday",    "postAt": 1746097200, "messageId": "Q02DEF567" },
    { "slot": "last_call", "postAt": 1746108000, "messageId": "Q03GHI890" },
    { "slot": "closed",    "postAt": 1746111600, "messageId": "Q04JKL123" }
  ],
  "cancelledExisting": 0
}
```

The endpoint is idempotent — re-running it on the same day clears the previous batch of scheduled messages from `#uk-office` and queues a fresh four.

Cost: free. GitHub Actions on private repos includes 2,000 minutes/month; we use ~30 seconds per run × 1 run/week × 4 weeks = 2 minutes/month.

---

## 5. Deploy the Next.js app to Vercel

### 5a. Create the project

1. Go to https://vercel.com/new.
2. Import the GitHub repo `shoreditchdesign/kudos`.
3. Framework preset will auto-detect as **Next.js**. Build command and output dir are correct out of the box.
4. **Environment Variables** — paste each value from `.env.local`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SLACK_SIGNING_SECRET`
   - `SLACK_BOT_TOKEN`
   - `SLACK_REMINDER_CHANNEL_ID`
   - `APP_BASE_URL` — set this to the prod URL **after** the first deploy completes (you'll know what it is then). For now use `https://placeholder.vercel.app`; we'll update.
   - `CRON_SECRET`
5. Click **Deploy**. First deploy takes ~2 min.

### 5b. Update `APP_BASE_URL`

After the deploy succeeds you'll see the URL (e.g. `https://kudos-abc123.vercel.app`). Go to **Settings → Environment Variables**, edit `APP_BASE_URL` to that URL (no trailing slash), and **Redeploy** from the **Deployments** tab.

### 5c. Update the Slack app URLs

Now that you have a stable deploy URL, go back to the Slack app config:

- **Slash Commands** → click `/win` → update Request URL to `https://<your-url>/api/slack/commands` → Save.
- **Interactivity & Shortcuts** → update Request URL to `https://<your-url>/api/slack/interactions` → Save.

---

## 6. Update GitHub repo secrets after the first Vercel deploy

If you set `APP_BASE_URL` in step 4 to a placeholder before knowing your Vercel URL, update it now in the repo's **Settings → Secrets and variables → Actions**. The workflow will pick up the new value on its next run (no re-deploy needed).

---

## 7. Smoke test

1. Hit `https://<your-url>/api/health` in a browser. Expect `{ "db": "ok", "slack_token_set": true, "reminder_channel_set": true, … }`.
2. In Slack, run `/win` somewhere — it should pop a modal with a person picker + textarea + the "Add whole team" checkbox (once we ship the layout work).
3. Submit a test win. Check Supabase **Table Editor** → `wins` — there should be one row.
4. Hit `https://<your-url>/` — the dropdown will probably be empty until Thursday 16:00 has passed for that week, but the page should render.

---

## Troubleshooting

- **`/win` says "dispatch_failed"** — Slack couldn't reach your Request URL. Most often: URL is wrong, deploy has crashed, or env vars are missing. Check Vercel's deployment logs.
- **Modal opens but submit does nothing** — Interactivity Request URL is wrong, or `SLACK_SIGNING_SECRET` doesn't match the app you installed. Double-check both.
- **Reminders don't post on Thursday** — check GitHub's **Actions** tab: confirm the most recent **Schedule Thursday reminders** run was green. If it was, look at the run's logs to see the JSON response from the schedule-week endpoint — `scheduled` should list four entries. If it's empty or errors, double-check that `CRON_SECRET` and `APP_BASE_URL` match exactly between GitHub repo secrets and Vercel env vars. If the action fired but the messages didn't appear in Slack, run `chat.scheduledMessages.list` in Slack's API tester to see whether they were queued (sometimes the bot's `chat:write.public` scope is missing).
- **"SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set"** — env vars haven't propagated; force a redeploy.

---

## What you give me when this is done

Reply with:

1. A `.env.local` (or just paste the values here) so I can keep it in sync if I need to debug.
2. Confirmation that:
   - `public/headshots/computer.png` is the missing-headshot fallback (already there).
   - `public/everyone.png` is the gallery image for "Add whole team" (drop it at that path).
   - `public/stickers/*` is the sticker pool (already there).

Then I'll finish the layout rebuild and we can test live.
