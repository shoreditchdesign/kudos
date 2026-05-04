import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Satori needs explicit ArrayBuffer fonts — it does not pick up system fonts.
// We load Cabinet Grotesk Regular (400), Medium (500), and Bold (700) from
// public/fonts/ on cold start and cache them for the life of the lambda.
//
// Get the .otf files from https://www.fontshare.com/fonts/cabinet-grotesk
// (free for commercial use under the Fontshare licence).

type LoadedFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 700;
  style: "normal";
};

let _cache: LoadedFont[] | null = null;

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  // Buffer.buffer can be a SharedArrayBuffer in some Node setups; copy into a
  // fresh ArrayBuffer so Satori's typing is happy.
  const out = new ArrayBuffer(buf.byteLength);
  new Uint8Array(out).set(buf);
  return out;
}

export async function loadFonts(): Promise<LoadedFont[]> {
  if (_cache) return _cache;

  const root = path.join(process.cwd(), "public", "fonts");

  const [regular, medium, bold] = await Promise.all([
    readFile(path.join(root, "CabinetGrotesk-Regular.otf")),
    readFile(path.join(root, "CabinetGrotesk-Medium.otf")),
    readFile(path.join(root, "CabinetGrotesk-Bold.otf")),
  ]);

  const fonts: LoadedFont[] = [
    { name: "Cabinet Grotesk", data: toArrayBuffer(regular), weight: 400, style: "normal" },
    { name: "Cabinet Grotesk", data: toArrayBuffer(medium), weight: 500, style: "normal" },
    { name: "Cabinet Grotesk", data: toArrayBuffer(bold), weight: 700, style: "normal" },
  ];
  _cache = fonts;
  return fonts;
}
