import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { STICKER_CORNERS, type StickerCorner } from "./geometry";

// Picks 2 stickers and 2 corners for a given win, deterministically seeded by
// winId so the same win always renders the same sticker layout (no flicker on
// refresh, deterministic for cache).
//
// The sticker pool is read from public/stickers at boot and cached.

let _pool: string[] | null = null;

async function loadPool(): Promise<string[]> {
  if (_pool) return _pool;
  const dir = path.join(process.cwd(), "public", "stickers");
  const entries = await readdir(dir);
  _pool = entries
    .filter((name) => /\.(png|jpe?g|webp|svg)$/i.test(name))
    .sort() // stable order so the seed maps consistently
    .map((name) => `/stickers/${name}`);
  return _pool;
}

const ALL_CORNERS: StickerCorner[] = [
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
];

/**
 * Mulberry32 — small, fast, well-distributed PRNG. Seed-deterministic.
 */
function makeRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 0x100000000;
  };
}

/** Produce a 32-bit unsigned int from the win id. */
function seedFromWinId(winId: string): number {
  const h = createHash("sha256").update(winId, "utf8").digest();
  return h.readUInt32BE(0);
}

/** Fisher–Yates over a shallow copy, returning the first `n` values. */
function pickN<T>(items: readonly T[], n: number, rng: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export type StickerPlacement = {
  imagePath: string;
  corner: StickerCorner;
  position: { left: number; top: number; width: number; height: number };
};

/**
 * Pick 2 stickers + 2 corners for a win. Returns an empty array if the pool
 * is empty (so missing stickers degrade gracefully rather than throwing).
 */
export async function pickStickersForWin(winId: string): Promise<StickerPlacement[]> {
  const pool = await loadPool();
  if (pool.length === 0) return [];

  const rng = makeRng(seedFromWinId(winId));

  // If the pool has only 1 sticker, place 1; if 0, none. Never duplicate.
  const stickerCount = Math.min(2, pool.length);

  const stickers = pickN(pool, stickerCount, rng);
  const corners = pickN(ALL_CORNERS, stickerCount, rng);

  return stickers.map((imagePath, i) => ({
    imagePath,
    corner: corners[i],
    position: STICKER_CORNERS[corners[i]],
  }));
}
