"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Check, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import type { WeekListItem } from "@/lib/wins";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { cn } from "@/lib/utils";

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

  async function copySlide(week: string, index: number) {
    setCopyStates((s) => ({ ...s, [index]: "copying" }));
    try {
      const res = await fetch(`/api/render/${week}/${index}.png`, {
        cache: "no-store",
      });
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

  const slides = manifest?.slides ?? [];
  const totalPages = Math.max(1, Math.ceil(slides.length / PAGE_SIZE));
  const visibleSlides = useMemo(
    () => slides.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [slides, page],
  );

  return (
    <main className="dark mx-auto flex min-h-screen max-w-[800px] flex-col gap-8 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Kudos</h1>
        <p className="text-sm text-muted-foreground">
          Weekly wins, ready to paste into Figma.
        </p>
      </header>

      {weeks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No closed weeks yet — submissions open until Thursday 16:00 Europe/London.
        </p>
      ) : (
        <>
          <section className="flex items-center gap-3">
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
              disabled={
                !manifest ||
                manifest.slideCount === 0 ||
                !clipboardSupported
              }
              onClick={() => manifest && copySlide(selected, 0)}
            >
              <Copy className="size-4" />
              Copy first
            </Button>
          </section>

          {manifestState === "loading" ? <FeedSkeleton /> : null}

          {manifestState === "error" ? (
            <p className="text-sm text-destructive">
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
              <p className="text-sm text-muted-foreground">
                {manifest.slideCount}{" "}
                {manifest.slideCount === 1 ? "weekly win" : "weekly wins"}
                {totalPages > 1
                  ? ` · page ${page + 1} of ${totalPages}`
                  : null}
              </p>

              {!clipboardSupported ? (
                <p className="rounded-md border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">
                  Your browser doesn&apos;t support clipboard images. Try Chrome
                  or Safari.
                </p>
              ) : null}

              <section className="flex flex-col gap-3">
                {visibleSlides.map((s) => (
                  <WinCard
                    key={s.winId}
                    slide={s}
                    state={copyStates[s.index] ?? "idle"}
                    onCopy={() => copySlide(selected, s.index)}
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
                  <span className="text-sm text-muted-foreground">
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
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarImage
                src={slide.sender.headshotPath}
                alt={slide.sender.fullName}
              />
              <AvatarFallback>
                {initialOf(slide.sender.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-tight">
                {slide.sender.fullName}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatTime(slide.createdAt)}
              </span>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={!canCopy || state === "copying"}
            onClick={onCopy}
          >
            <CopyButtonIcon state={state} />
            <span className="hidden sm:inline">{copyButtonLabel(state)}</span>
          </Button>
        </div>

        <p className="text-sm leading-relaxed text-foreground">
          {slide.messagePreview}
        </p>

        <div className="flex items-center gap-2">
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
            <AvatarImage src={r.headshotPath} alt={r.fullName} />
            <AvatarFallback className="text-[10px]">
              {initialOf(r.fullName)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      {overflow > 0 ? (
        <Badge variant="secondary" className="text-xs">
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
          <CardContent className="flex flex-col gap-3 p-4">
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

function initialOf(name: string): string {
  return name.charAt(0).toUpperCase();
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
