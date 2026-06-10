import "server-only";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { renderSlideJsx, SLIDE_DIMENSIONS } from "./layouts";
import { loadFonts } from "./fonts";
import { loadEmojiAsset } from "./emoji";
import { pickStickersForWin } from "./stickers";
import type { WinSlide } from "./layout";

type LoadedFont = Awaited<ReturnType<typeof loadFonts>>;

// Satori asks for an asset whenever a grapheme isn't covered by the embedded
// fonts. `code === "emoji"` means an emoji grapheme — we return a Twemoji PNG
// data URI (or "" to fall back to tofu). Anything else (e.g. a CJK language
// code) we don't supply, so Satori keeps its own fallback behaviour.
async function loadAdditionalAsset(code: string, segment: string): Promise<string> {
  if (code === "emoji") return loadEmojiAsset(segment);
  return "";
}

async function rasterize(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsx: any,
  fonts: LoadedFont,
  withEmoji: boolean,
): Promise<Uint8Array> {
  const svg = await satori(jsx, {
    width: SLIDE_DIMENSIONS.width,
    height: SLIDE_DIMENSIONS.height,
    fonts,
    ...(withEmoji ? { loadAdditionalAsset } : {}),
  });
  return new Resvg(svg).render().asPng();
}

/**
 * Render a single slide PNG. On-demand: called from the
 * /api/render/[week]/[file] route handler, once per slide.
 *
 * Returns the PNG as a Uint8Array.
 */
export async function renderSlidePng(slide: WinSlide): Promise<Uint8Array> {
  const [fonts, stickers] = await Promise.all([
    loadFonts(),
    pickStickersForWin(slide.winId),
  ]);

  const jsx = renderSlideJsx(slide, stickers);

  try {
    return await rasterize(jsx, fonts, true);
  } catch (err) {
    // Belt-and-suspenders: if anything in the emoji path breaks the render,
    // fall back to a plain render (emoji as tofu) rather than failing the
    // slide. Never worse than the pre-emoji behaviour.
    console.error("[render] emoji render failed, retrying without emoji", err);
    return rasterize(jsx, fonts, false);
  }
}
