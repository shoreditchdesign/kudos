"use client";

import { useEffect, useState } from "react";
import type { WeekListItem } from "@/lib/wins";

type Manifest = {
  weekStartDate: string;
  weekEndDate: string;
  slideCount: number;
  layoutClass: string;
  winsCount: number;
  recipientCount: number;
};

type CopyState = "idle" | "copying" | "copied" | "error";

export function CopyPage({ weeks }: { weeks: WeekListItem[] }) {
  const initial = weeks[0]?.weekStartDate ?? "";
  const [selected, setSelected] = useState(initial);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestState, setManifestState] = useState<"idle" | "loading" | "error">("idle");
  const [copyStates, setCopyStates] = useState<Record<number, CopyState>>({});

  const clipboardSupported =
    typeof window !== "undefined" && "ClipboardItem" in window;

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setManifest(null);
    setCopyStates({});
    setManifestState("loading");

    fetch(`/api/render/${selected}/manifest.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((m: Manifest) => {
        if (cancelled) return;
        setManifest(m);
        setManifestState("idle");
      })
      .catch(() => {
        if (cancelled) return;
        setManifestState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function copySlide(week: string, index: number) {
    setCopyStates((s) => ({ ...s, [index]: "copying" }));
    try {
      const res = await fetch(`/api/render/${week}/${index}.png`, { cache: "no-store" });
      if (!res.ok) throw new Error(`render ${res.status}`);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopyStates((s) => ({ ...s, [index]: "copied" }));
      setTimeout(() => {
        setCopyStates((s) => ({ ...s, [index]: "idle" }));
      }, 1500);
    } catch {
      setCopyStates((s) => ({ ...s, [index]: "error" }));
      setTimeout(() => {
        setCopyStates((s) => ({ ...s, [index]: "idle" }));
      }, 2000);
    }
  }

  async function copyAll(week: string, count: number) {
    for (let i = 0; i < count; i++) {
      await copySlide(week, i);
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (weeks.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
        <header>
          <h1 className="text-2xl font-semibold">Kudos</h1>
          <p className="text-sm text-zinc-400">
            Weekly wins, ready to paste into Figma.
          </p>
        </header>
        <p className="text-zinc-300">
          No closed weeks yet — submissions open until Thursday 16:00
          Europe/London.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Kudos</h1>
        <p className="text-sm text-zinc-400">
          Weekly wins, ready to paste into Figma.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wider text-zinc-400">
            Week
          </span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full max-w-md rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          >
            {weeks.map((w) => (
              <option key={w.weekStartDate} value={w.weekStartDate}>
                {w.label}
              </option>
            ))}
          </select>
        </label>

        {manifest ? (
          <p className="text-xs text-zinc-400">
            {manifest.winsCount} wins · {manifest.recipientCount} recipients ·{" "}
            {manifest.slideCount} slide{manifest.slideCount === 1 ? "" : "s"}
          </p>
        ) : null}
      </section>

      {!clipboardSupported ? (
        <p className="rounded-md border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">
          Your browser doesn&apos;t support clipboard images. Try Chrome or
          Safari, or right-click a preview to save it.
        </p>
      ) : null}

      {manifestState === "loading" ? (
        <p className="text-sm text-zinc-400">Loading slides…</p>
      ) : null}

      {manifestState === "error" ? (
        <p className="text-sm text-rose-400">
          Couldn&apos;t load this week.{" "}
          <button
            onClick={() => setSelected(selected)}
            className="underline"
          >
            Refresh
          </button>
        </p>
      ) : null}

      {manifest ? (
        <section className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: manifest.slideCount }, (_, i) => (
              <SlideCard
                key={i}
                week={selected}
                index={i}
                state={copyStates[i] ?? "idle"}
                onCopy={() => copySlide(selected, i)}
                disabled={!clipboardSupported}
              />
            ))}
          </div>

          {manifest.slideCount > 1 && clipboardSupported ? (
            <button
              onClick={() => copyAll(selected, manifest.slideCount)}
              className="w-full max-w-md rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm hover:bg-zinc-800"
            >
              Copy all → paste sequentially
            </button>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function SlideCard({
  week,
  index,
  state,
  onCopy,
  disabled,
}: {
  week: string;
  index: number;
  state: CopyState;
  onCopy: () => void;
  disabled: boolean;
}) {
  const label =
    state === "copying"
      ? "Copying…"
      : state === "copied"
        ? "✓ Copied"
        : state === "error"
          ? "Copy failed — click again"
          : `Copy slide ${index + 1}`;

  return (
    <div className="flex flex-col gap-2">
      <img
        src={`/api/render/${week}/${index}.png`}
        alt={`Slide ${index + 1} for week of ${week}`}
        className="aspect-video w-full rounded-md border border-zinc-800 bg-zinc-950 object-contain"
        loading="lazy"
      />
      <button
        onClick={onCopy}
        disabled={disabled || state === "copying"}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {label}
      </button>
    </div>
  );
}
