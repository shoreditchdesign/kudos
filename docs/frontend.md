# Kudos — Frontend

> Companion to `master-architecture.md`. This document covers the **single web page** the operator uses on Thursday afternoons. The Slack bot has no frontend; it lives in modals supplied by Slack.

## 1. Scope

One page at `/`. No login. No router. No multi-page navigation.

The page exists for exactly one task: at the end of the Thursday meeting, one person opens it, picks a week from a dropdown, and clicks a button per slide to copy the rendered PNG to their clipboard so they can paste it into the Figma deck.

Anything that isn't directly in service of that flow doesn't ship.

## 2. Page anatomy

```
┌─────────────────────────────────────────────────────────────┐
│  Kudos                                                      │
│  Weekly wins, ready to paste into Figma.                    │
│                                                             │
│  Week  [▼ 25 Apr – 1 May 2026                ]              │
│                                                             │
│        42 wins · 19 recipients · 3 slides                   │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │                  │  │                  │                 │
│  │   slide 1 PNG    │  │   slide 2 PNG    │   …             │
│  │                  │  │                  │                 │
│  └──────────────────┘  └──────────────────┘                 │
│   [ Copy slide 1 ]      [ Copy slide 2 ]                    │
│                                                             │
│   [ Copy all → paste sequentially ]                         │
└─────────────────────────────────────────────────────────────┘
```

That is the entire page.

## 3. Components

Single client component tree, no library beyond Tailwind:

```
app/page.tsx               — server component; fetches the list of weeks
└── <CopyPage>              ("use client") — owns dropdown state + copy logic
    ├── <WeekSelect>        — native <select>, populated server-side
    ├── <SlideGrid>         — renders <SlideCard> for each index
    │   └── <SlideCard>     — <img> preview + copy button
    └── <CopyAllButton>     — sequences clipboard writes
```

No shadcn/ui in v2. Tailwind utility classes only. Adding a component lib means tracking another dependency for one page.

## 4. State

Three pieces of state, all in `<CopyPage>`:

- `selectedWeek: string` — the currently chosen `week_start_date` (YYYY-MM-DD). Defaults to the first item in the list (most recent closed week).
- `manifest: { slideCount, layoutClass, recipientCount, winsCount } | null` — fetched from `/api/render/<week>/manifest.json` whenever `selectedWeek` changes.
- `copyState: Record<number, 'idle' | 'copying' | 'copied' | 'error'>` — UI feedback per slide. Resets when the week changes.

No global store, no context, no SWR. `useEffect` + `fetch` is enough.

## 5. Copy mechanic

```ts
async function copySlide(week: string, index: number) {
  const res = await fetch(`/api/render/${week}/${index}.png`);
  const blob = await res.blob();
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob }),
  ]);
}
```

Browser support note: `ClipboardItem` is supported in Chrome, Edge, Safari, and Firefox 127+. We do **not** support older Firefox. The page detects support via `'ClipboardItem' in window` and shows a fallback message ("Your browser doesn't support clipboard images — try Chrome or Safari") instead of broken buttons.

Permissions: `navigator.clipboard.write` requires the page to be focused and served over HTTPS. Vercel deploys are HTTPS by default. Focus is satisfied because the operator is the one clicking.

The "Copy all" button copies slides in sequence (200ms delay between writes) — the system clipboard only holds one image at a time, but Figma is fine with the operator alt-tabbing once per slide. The button is mostly there for two- and three-slide weeks.

## 6. Server-fetched data

The page (a server component) fetches the list of available weeks at request time:

```ts
// app/page.tsx
import { listClosedWeeks } from '@/lib/wins';

export default async function Page() {
  const weeks = await listClosedWeeks(); // [{ weekStartDate, weekEndDate, label }]
  return <CopyPage weeks={weeks} />;
}
```

`listClosedWeeks()` queries `select distinct week_start_date from wins where week_start_date <= currentClosedWeekStart() order by week_start_date desc limit 26` — six months of history is plenty for the meeting.

The current in-progress week is never in the list (the cutoff filter in `lib/week.ts` enforces this).

The manifest endpoint returns:

```jsonc
{
  "weekStartDate": "2026-04-25",
  "weekEndDate":   "2026-05-01",
  "slideCount":    3,
  "layoutClass":   "medium",
  "winsCount":     42,
  "recipientCount":19
}
```

The page uses `slideCount` to render the right number of `<SlideCard>`s. The PNG itself is fetched lazily by the `<img src>` (the browser handles caching once Cache-Control is respected).

## 7. Visual design

Minimal and meeting-appropriate. Dark mode by default to match the meeting room projector.

- Background: `--background` (near-black).
- Text: `--foreground` (off-white).
- Accent: a single warm yellow (`#FFD166`) used for the copy button hover and the "copied" check.
- Typography: system stack via `-apple-system, BlinkMacSystemFont, …` to avoid a font-loading flash.
- No shadows, no gradients, no card chrome — just slide previews on the page.

The slide PNGs themselves are the visual centre of the page; surrounding chrome should fade.

## 8. States

| State | What's shown |
| --- | --- |
| First load, weeks list is non-empty | Page renders with the most recent closed week selected and slides loading. |
| First load, no closed weeks yet | "No closed weeks yet — submissions open until Thursday 16:00 Europe/London." |
| Manifest fetch in flight | "Loading slides…" placeholder (no spinner; just text). |
| Manifest fetch failed | "Couldn't load this week. Refresh." with a retry button. |
| Slide PNG fetch failed (broken `<img>`) | Error PNG returned by the render route is shown — see `master-architecture.md` §13. |
| Clipboard unsupported | Inline message replacing the buttons; preview PNGs still load so a screenshot is possible. |
| Copy in progress | Button label switches to "Copying…", disabled. |
| Copy succeeded | Button label switches to "✓ Copied" for 1.5s, then resets. |
| Copy failed (rare; permission denied) | Button label switches to "Copy failed — click again", then resets. |

## 9. Routes

| Path | Method | Handler | Notes |
| --- | --- | --- | --- |
| `/` | GET | server component | The copy page. Lists weeks, hosts the client component. |
| `/api/render/[week]/manifest.json` | GET | route handler | Returns slide count + counts for a week. |
| `/api/render/[week]/[index].png` | GET | route handler | Satori → Resvg → PNG. 5-min cache. |
| `/api/slack/commands` | POST | route handler | `/win` slash command. |
| `/api/slack/interactions` | POST | route handler | Modal submit. |
| `/api/cron/reminders` | POST | route handler | Vercel-Cron-only; bearer-protected. |
| `/api/health` | GET | route handler | DB + Slack token age check. |

Slack endpoints and cron handler are documented in `master-architecture.md` §7 + §10.

## 10. Accessibility

- Native `<select>` for the dropdown — works with keyboard, screen readers, and OS-level zoom out of the box.
- Copy buttons are `<button>` with descriptive text ("Copy slide 1", "Copy slide 2"); no icon-only buttons.
- Slide previews have `alt="Slide N for week of <date>"`.
- Color contrast meets WCAG AA on the dark background.

We are not chasing AAA for an internal tool, but baseline keyboard + screen-reader access is free if we stick to native elements.

## 11. Performance

There is no performance budget worth defending — single page, ~30 weeks of dropdown options, <10 PNGs at most. The thing that *would* hurt is if the render route blocked a meeting, so:

- Render route caches PNG bytes for 5 minutes (Cache-Control + Vercel edge).
- The page does not block on slide fetches — it renders the dropdown and skeleton boxes first, then `<img>` tags hydrate.
- No client-side analytics, no third-party scripts, no fonts.

Cold start of the render route should be under 2s on Vercel's free tier (Satori + Resvg are fast; the bottleneck is Resvg loading WASM if we're not careful, so we use `@resvg/resvg-js` which is native Node).

## 12. Files

```
app/
  layout.tsx              — minimal HTML shell, dark mode default, noindex meta
  globals.css             — Tailwind reset + the four CSS variables we actually use
  page.tsx                — server component, fetches week list
  copy-page.tsx           — "use client" component (owns state + clipboard)
  api/
    render/
      [week]/
        manifest.json/route.ts
        [index]/png.ts    — see Next.js dynamic-route convention
    slack/
      commands/route.ts
      interactions/route.ts
    cron/
      reminders/route.ts
    health/route.ts

lib/
  week.ts                 — week boundary math (Europe/London)
  wins.ts                 — listClosedWeeks(), insertWin(), getWeekWins()
  db.ts                   — supabase service-role client (server-only)
  slack/
    verify.ts             — HMAC signature verification
    client.ts             — slim @slack/web-api wrapper
    modal.ts              — view payload for the /win modal
    handlers.ts           — slash command + interactivity dispatch
    reminders.ts          — reminder copy + scheduling logic
  render/
    layout.ts             — pickLayoutClass + DigestPayload type
    layouts.tsx           — Satori JSX components
    render.ts             — payload → PNG bytes
    fonts.ts              — font loader for Satori

config/
  members.ts              — Slack ID → identity

public/
  headshots/<slackId>.png — committed
  fonts/                  — Inter Regular + Bold, .ttf
```

## 13. Backlog (deferred)

These are intentionally not in v2 ship:

- `multi_user_groups_select` block in the modal so people can `@design-team` someone.
- Decorative emojis around headshots on slides (the v1 IA mentioned this).
- Edit/delete a submitted win (currently re-submit + ignore).
- Per-user "wins sent / received this year" counters.
- Admin-only "regenerate slides" button (currently the operator just refreshes).
- ZIP download for weeks with many slides (currently "Copy all" handles it).
- A `/winrm <id>` slash command for typo recovery.

If any of these become "needed in the next sprint," reopen the scope conversation. Most will quietly go away.
