"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Copy, Check, AlertCircle, ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { WeekListItem } from "@/lib/wins";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type SlideManifest = {
  index: number;
  winId: string;
  createdAt: string;
  variant: string;
  isEveryone: boolean;
  sender: {
    slackUserId: string;
    fullName: string;
    headshotPath: string;
  };
  recipients: Array<{
    slackUserId: string;
    fullName: string;
    headshotPath: string;
  }>;
  overflowCount: number;
  messagePreview: string;
};

type Manifest = {
  weekStartDate: string;
  weekEndDate: string;
  slideCount: number;
  slides: SlideManifest[];
};

type CopyState = "idle" | "copying" | "copied" | "error";

const PAGE_SIZE = 15;

/**
 * Copies a single slide PNG to the system clipboard.
 *
 * The Promise-based ClipboardItem form (passing fetch directly, not a pre-
 * resolved Blob) is the cross-browser-safe pattern. Safari requires the
 * write to happen synchronously with the user gesture; pre-fetching the
 * Blob breaks that gesture link.
 */
async function copySlideToClipboard(week: string, index: number): Promise<void> {
  if (!("ClipboardItem" in window)) {
    throw new Error("Clipboard API not supported in this browser");
  }
  const url = `/api/render/${week}/${index}.png`;
  const item = new ClipboardItem({
    "image/png": fetch(url, { cache: "no-store" }).then(async (res) => {
      if (!res.ok) {
        throw new Error(`render returned ${res.status}`);
      }
      return res.blob();
    }),
  });
  await navigator.clipboard.write([item]);
}

export function CopyPage({ weeks }: { weeks: WeekListItem[] }) {
  const initial = weeks[0]?.weekStartDate ?? "";
  const [selected, setSelected] = useState(initial);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestState, setManifestState] = useState<"idle" | "loading" | "error">(
    initial ? "loading" : "idle",
  );
  const [copyStates, setCopyStates] = useState<Record<number, CopyState>>({});
  const [page, setPage] = useState(0);

  const clipboardSupported =
    typeof window !== "undefined" && "ClipboardItem" in window;

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setManifest(null);
    setCopyStates({});
    setPage(0);
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

  // Prefetch all slide PNGs in the background as soon as the manifest is
  // known. Two wins:
  //   1. Warms Vercel's per-route edge cache (5min) so downstream requests
  //      from the ZIP route or from the user's clipboard click are instant.
  //   2. Cold-start render time (~3-5s) doesn't break clipboard.write, which
  //      has a ~5s internal timeout on the user-gesture promise.
  useEffect(() => {
    if (!manifest || manifest.slideCount === 0) return;
    const controller = new AbortController();
    for (const s of manifest.slides) {
      // Fire-and-forget; "force-cache" lets the browser dedupe with the
      // later clipboard fetch.
      fetch(`/api/render/${selected}/${s.index}.png`, {
        cache: "force-cache",
        signal: controller.signal,
      }).catch(() => {
        // ignore — prefetch is best-effort
      });
    }
    return () => controller.abort();
  }, [manifest, selected]);

  async function copyOne(index: number) {
    setCopyStates((s) => ({ ...s, [index]: "copying" }));
    try {
      await copySlideToClipboard(selected, index);
      setCopyStates((s) => ({ ...s, [index]: "copied" }));
      setTimeout(() => {
        setCopyStates((s) => ({ ...s, [index]: "idle" }));
      }, 1500);
    } catch (err) {
      console.error("[copy] slide", index, "failed:", err);
      setCopyStates((s) => ({ ...s, [index]: "error" }));
      setTimeout(() => {
        setCopyStates((s) => ({ ...s, [index]: "idle" }));
      }, 2500);
    }
  }

  const slides = manifest?.slides ?? [];
  const totalPages = Math.max(1, Math.ceil(slides.length / PAGE_SIZE));
  const visibleSlides = useMemo(
    () => slides.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [slides, page],
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-[800px] flex-col gap-8 px-8 py-24">
      <header className="flex flex-col gap-1">
        <h1 className="font-cabinet text-3xl font-semibold">Kudos</h1>
        <p className="text-base text-muted-foreground">
          Weekly wins, ready to paste into Figma.
        </p>
      </header>

      {weeks.length === 0 ? (
        <p className="text-base text-muted-foreground">
          No closed weeks yet — submissions open until Thursday 16:00 Europe/London.
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Pick a week" />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((w) => (
                  <SelectItem key={w.weekStartDate} value={w.weekStartDate}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!manifest || manifest.slideCount === 0}
              asChild={Boolean(manifest && manifest.slideCount > 0)}
              className="bg-[#FF593F] text-white hover:bg-[#FF593F]/90"
            >
              {manifest && manifest.slideCount > 0 ? (
                <a href={`/api/render/${selected}/all.zip`} download>
                  <Download className="size-4" />
                  Download All
                </a>
              ) : (
                <span>
                  <Download className="size-4" />
                  Download All
                </span>
              )}
            </Button>
          </section>

          {manifestState === "loading" ? <FeedSkeleton /> : null}

          {manifestState === "error" ? (
            <p className="text-base text-destructive">
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
            <>
              <p className="text-base text-muted-foreground">
                {manifest.slideCount}{" "}
                {manifest.slideCount === 1 ? "weekly win" : "weekly wins"}
                {totalPages > 1
                  ? ` · page ${page + 1} of ${totalPages}`
                  : null}
              </p>

              {!clipboardSupported ? (
                <p className="rounded-md border border-amber-700 bg-amber-950/40 p-3 text-base text-amber-200">
                  Your browser doesn&apos;t support clipboard images. Try Chrome
                  or Safari.
                </p>
              ) : null}

              <section className="flex flex-col gap-4">
                {visibleSlides.map((s) => (
                  <WinCard
                    key={s.winId}
                    slide={s}
                    state={copyStates[s.index] ?? "idle"}
                    onCopy={() => copyOne(s.index)}
                    canCopy={clipboardSupported}
                  />
                ))}
              </section>

              {totalPages > 1 ? (
                <div className="mt-2 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>
                  <span className="text-base text-muted-foreground">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={page >= totalPages - 1}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </main>
  );
}

function WinCard({
  slide,
  state,
  onCopy,
  canCopy,
}: {
  slide: SlideManifest;
  state: CopyState;
  onCopy: () => void;
  canCopy: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-[18px] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <Image
                src={slide.sender.headshotPath}
                alt={slide.sender.fullName}
                width={72}
                height={72}
                className="size-full object-cover"
              />
            </Avatar>
            <div className="flex flex-col">
              <span className="text-base font-medium leading-tight">
                {slide.sender.fullName}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatTime(slide.createdAt)}
              </span>
            </div>
          </div>

          <Button
            variant="white"
            disabled={!canCopy || state === "copying"}
            onClick={onCopy}
          >
            <CopyButtonIcon state={state} />
            <span className="hidden sm:inline">{copyButtonLabel(state)}</span>
          </Button>
        </div>

        <p className="text-base leading-snug text-foreground line-clamp-2">
          {slide.messagePreview}
        </p>

        <div className="flex items-center justify-end gap-2">
          {slide.isEveryone ? (
            <Badge variant="secondary">Whole team</Badge>
          ) : (
            <RecipientStack
              recipients={slide.recipients}
              overflow={slide.overflowCount}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RecipientStack({
  recipients,
  overflow,
}: {
  recipients: SlideManifest["recipients"];
  overflow: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {recipients.map((r) => (
          <Avatar
            key={r.slackUserId}
            className="size-6 border-2 border-background"
          >
            <Image
              src={r.headshotPath}
              alt={r.fullName}
              width={48}
              height={48}
              className="size-full object-cover"
            />
          </Avatar>
        ))}
      </div>
      {overflow > 0 ? (
        <Badge variant="secondary" className="text-sm">
          +{overflow}
        </Badge>
      ) : null}
    </div>
  );
}

function CopyButtonIcon({ state }: { state: CopyState }) {
  if (state === "copied") return <Check className="size-4" />;
  if (state === "error") return <AlertCircle className="size-4" />;
  return <Copy className="size-4" />;
}

function copyButtonLabel(state: CopyState): string {
  switch (state) {
    case "copying":
      return "Copying…";
    case "copied":
      return "Copied";
    case "error":
      return "Failed";
    default:
      return "Copy";
  }
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-[18px] p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-1">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="size-6 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
      timeZone: "Europe/London",
    }).format(d);
  } catch {
    return "";
  }
}
