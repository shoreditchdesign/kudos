# Headshots

One PNG per team member, used in the slide renderer.

Spec:

- **Aspect ratio: 3:4 portrait** (e.g. 900×1200 px is the canonical size; 300×400 also works).
- Subject tightly cropped — head + shoulders, framed for the 3:4 capsule.
- Transparent or solid background — the renderer paints a coral capsule behind.
- Filename: `<firstname-lastname>.png` in lowercase kebab-case. The same key is used in `config/members.ts` to map this person to their Slack user ID and email.

When a team member doesn't have a headshot in this directory, the renderer falls back to `computer.png` — a placeholder PC illustration on a coral capsule. Keep this file in place; it's not anyone's photo, just the missing-headshot fallback.

The "Add whole team" gallery image (used when a sender ticks the checkbox in the Slack modal) lives separately at `public/everyone.png` — it replaces the headshot grid entirely with that single square image.
