import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Color-emoji support for slide rendering.
//
// Satori embeds the text fonts (Cabinet Grotesk) but those have no emoji
// glyphs, so an emoji renders as a tofu box (□). Satori's `loadAdditionalAsset`
// hook lets us hand back an image for each emoji grapheme instead — we map the
// grapheme to a bundled Twemoji PNG (public/emoji/<codepoints>.png) and return
// it as a base64 data URI, which Satori inlines as an <img>.
//
// Everything here degrades to the old tofu box on any failure: an emoji not in
// the bundle, a read error, or a slow read all resolve to "" — Satori then
// falls back to the text font, i.e. exactly today's behaviour. Emoji loading
// can never break or stall a slide render.

const EMOJI_DIR = path.join(process.cwd(), "public", "emoji");

// PNG is deliberate: @resvg/resvg-js (our SVG→PNG stage) is unreliable with
// SVG-in-<image> data URIs, but rasterizes embedded PNGs cleanly.
const ZERO_WIDTH_JOINER = 0x200d;
const VARIATION_SELECTOR_16 = 0xfe0f;

// Per-emoji read budget. Local disk reads are sub-millisecond, but if anything
// ever stalls we lose the race and fall back to tofu rather than hanging the
// render.
const READ_TIMEOUT_MS = 50;

// Resolved data URIs (and negative results, cached as "") keyed by grapheme, so
// a repeated emoji across slides — or a known-missing one — is never re-read.
const _cache = new Map<string, string>();

/**
 * Candidate Twemoji filenames (without extension) for an emoji grapheme, in
 * priority order. Mirrors Twemoji's own naming: codepoints as lowercase hex,
 * hyphen-joined, with U+FE0F stripped unless the sequence is a ZWJ sequence.
 * We also try the raw and fully-stripped forms as fallbacks.
 */
function candidateNames(segment: string): string[] {
  const cps = Array.from(segment, (c) => c.codePointAt(0) ?? 0);
  const hasZwj = cps.includes(ZERO_WIDTH_JOINER);
  const hex = (arr: number[]) => arr.map((c) => c.toString(16)).join("-");

  const raw = hex(cps);
  const stripped = hex(cps.filter((c) => c !== VARIATION_SELECTOR_16));
  // Twemoji keeps FE0F for ZWJ sequences, strips it otherwise.
  const primary = hasZwj ? raw : stripped;

  return Array.from(new Set([primary, raw, stripped])).filter(Boolean);
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

async function readFirstExisting(names: string[]): Promise<string> {
  for (const name of names) {
    try {
      const buf = await readFile(path.join(EMOJI_DIR, `${name}.png`));
      return `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      // try next candidate; ENOENT for an emoji we don't bundle is expected
    }
  }
  return "";
}

/**
 * Resolve an emoji grapheme to a PNG data URI, or "" if we can't (unknown
 * emoji, read error, or too slow). Pass the result straight to Satori's
 * `loadAdditionalAsset` — an empty string makes Satori fall back to the text
 * font (tofu), which is the pre-existing behaviour.
 */
export async function loadEmojiAsset(segment: string): Promise<string> {
  const cached = _cache.get(segment);
  if (cached !== undefined) return cached;

  const result = await withTimeout(
    readFirstExisting(candidateNames(segment)),
    READ_TIMEOUT_MS,
    "",
  );
  _cache.set(segment, result);
  return result;
}
