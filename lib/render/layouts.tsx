import type { ReactElement } from "react";
import path from "node:path";
import { readFileSync } from "node:fs";
import { EVERYONE_IMAGE_PATH } from "@/config/members";
import {
  EVERYONE_SLOT,
  HEADSHOT_SLOTS,
  type HeadshotSlot,
} from "./geometry";
import { SLIDE_HEIGHT, SLIDE_WIDTH, type WinSlide } from "./layout";
import type { StickerPlacement } from "./stickers";

// Tokens lifted from the Figma source (file cmuEjKJYLnaDRaKCKOdMqw, node
// 7318:964). All sizes in px, all weights documented for Cabinet Grotesk.

const TOKENS = {
  bg: "#FFFFFF",
  fg: "#0B0B0B",
  // The coral capsule colour is baked into the headshot PNGs themselves —
  // we don't paint a coloured background underneath. For unknown-member
  // fallbacks we use the same token so the placeholder feels consistent.
  capsuleFallback: "#F76250",
} as const;

const TYPE = {
  message: { weight: 700, size: 64, letterSpacing: -2.3305 },
  caption: { weight: 700, size: 21.578, letterSpacing: 0.29, lineHeight: 28.004 },
  sender: { weight: 500, size: 42, letterSpacing: -1.7683 },
} as const;

// Right-panel layout (shared by all variants).
const RIGHT_PANEL = {
  left: 990,
  top: 0,
  width: 950,
  height: SLIDE_HEIGHT,
  paddingY: 110,
  paddingRight: 100,
  gap: 29,
  quotePaddingLeft: 23,
  tagPaddingX: 23,
  tagGap: 5,
} as const;

// Sender pill.
const SENDER_PILL = {
  borderWidth: 2,
  borderColor: "#000000",
  paddingX: 23,
  paddingY: 6,
  borderRadius: 200,
} as const;

// ---------------------------------------------------------------------------
// images
// ---------------------------------------------------------------------------

// Satori loads images from URLs. When APP_BASE_URL is set in production we
// use absolute URLs so the renderer can fetch from the deployed origin; in
// dev we read straight off disk and inline as data URIs. This avoids
// chicken-and-egg "renderer fetches from itself" problems on cold start.

const APP_BASE_URL = process.env.APP_BASE_URL ?? "";

function publicAbsPath(publicPath: string): string {
  return path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
}

function inlineDataUri(publicPath: string): string {
  try {
    const buf = readFileSync(publicAbsPath(publicPath));
    const ext = publicPath.split(".").pop()?.toLowerCase();
    const mime =
      ext === "svg"
        ? "image/svg+xml"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "webp"
            ? "image/webp"
            : "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

function imageSrc(publicPath: string): string {
  // In production we prefer absolute URLs (lighter payload, cached at CDN).
  // Locally / when APP_BASE_URL is unset, inline so Satori never makes an
  // HTTP request.
  if (APP_BASE_URL) return `${APP_BASE_URL}${publicPath}`;
  return inlineDataUri(publicPath);
}

// ---------------------------------------------------------------------------
// shared chrome
// ---------------------------------------------------------------------------

function RightPanel({ message, senderFullName }: { message: string; senderFullName: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: RIGHT_PANEL.left,
        top: RIGHT_PANEL.top,
        width: RIGHT_PANEL.width,
        height: RIGHT_PANEL.height,
        backgroundColor: TOKENS.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: RIGHT_PANEL.paddingY,
        paddingBottom: RIGHT_PANEL.paddingY,
        paddingRight: RIGHT_PANEL.paddingRight,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          paddingLeft: RIGHT_PANEL.quotePaddingLeft,
          marginBottom: RIGHT_PANEL.gap,
        }}
      >
        <div
          style={{
            fontFamily: "Cabinet Grotesk",
            fontWeight: TYPE.message.weight,
            fontSize: TYPE.message.size,
            letterSpacing: TYPE.message.letterSpacing,
            color: TOKENS.fg,
            lineHeight: 1.05,
            display: "flex",
            whiteSpace: "pre-wrap",
          }}
        >
          {message}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: SENDER_PILL.borderWidth + RIGHT_PANEL.tagGap,
        }}
      >
        <div
          style={{
            paddingLeft: RIGHT_PANEL.tagPaddingX,
            paddingRight: RIGHT_PANEL.tagPaddingX,
            display: "flex",
          }}
        >
          <div
            style={{
              fontFamily: "Cabinet Grotesk",
              fontWeight: TYPE.caption.weight,
              fontSize: TYPE.caption.size,
              letterSpacing: TYPE.caption.letterSpacing,
              lineHeight: `${TYPE.caption.lineHeight}px`,
              color: TOKENS.fg,
              display: "flex",
            }}
          >
            FROM
          </div>
        </div>

        <div
          style={{
            border: `${SENDER_PILL.borderWidth}px solid ${SENDER_PILL.borderColor}`,
            borderRadius: SENDER_PILL.borderRadius,
            paddingLeft: SENDER_PILL.paddingX,
            paddingRight: SENDER_PILL.paddingX,
            paddingTop: SENDER_PILL.paddingY,
            paddingBottom: SENDER_PILL.paddingY,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: "Cabinet Grotesk",
              fontWeight: TYPE.sender.weight,
              fontSize: TYPE.sender.size,
              letterSpacing: TYPE.sender.letterSpacing,
              color: TOKENS.fg,
              whiteSpace: "nowrap",
              display: "flex",
            }}
          >
            {senderFullName}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// headshot capsules
// ---------------------------------------------------------------------------

function Capsule({
  slot,
  imagePath,
  fallbackInitial,
  badgeText,
}: {
  slot: HeadshotSlot;
  imagePath: string;
  fallbackInitial?: string;
  /** When set, overlays a "+N" badge in the bottom-right of the capsule. */
  badgeText?: string;
}) {
  const radius = Math.max(slot.width, slot.height); // stadium pill
  return (
    <div
      style={{
        position: "absolute",
        left: slot.left,
        top: slot.top,
        width: slot.width,
        height: slot.height,
        borderRadius: radius,
        backgroundColor: TOKENS.capsuleFallback,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {imagePath ? (
        <img
          src={imageSrc(imagePath)}
          width={slot.width}
          height={slot.height}
          style={{
            width: slot.width,
            height: slot.height,
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            color: TOKENS.bg,
            fontFamily: "Cabinet Grotesk",
            fontWeight: 700,
            fontSize: Math.round(slot.width / 3),
            display: "flex",
          }}
        >
          {fallbackInitial ?? ""}
        </div>
      )}

      {badgeText ? (
        <div
          style={{
            position: "absolute",
            right: 16,
            bottom: 16,
            backgroundColor: "#000000",
            color: TOKENS.bg,
            fontFamily: "Cabinet Grotesk",
            fontWeight: 700,
            fontSize: 36,
            paddingLeft: 18,
            paddingRight: 18,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {badgeText}
        </div>
      ) : null}
    </div>
  );
}

function HeadshotGrid({ slide }: { slide: WinSlide }) {
  if (slide.variant === "everyone") {
    return (
      <div
        style={{
          position: "absolute",
          left: EVERYONE_SLOT.left,
          top: EVERYONE_SLOT.top,
          width: EVERYONE_SLOT.width,
          height: EVERYONE_SLOT.height,
          display: "flex",
        }}
      >
        <img
          src={imageSrc(EVERYONE_IMAGE_PATH)}
          width={EVERYONE_SLOT.width}
          height={EVERYONE_SLOT.height}
          style={{
            width: EVERYONE_SLOT.width,
            height: EVERYONE_SLOT.height,
            objectFit: "cover",
          }}
        />
      </div>
    );
  }

  const slots = HEADSHOT_SLOTS[slide.variant];
  const lastIndex = slots.length - 1;

  return (
    <>
      {slots.map((slot, i) => {
        const recipient = slide.recipients[i];
        const isLast = i === lastIndex;
        const showBadge = isLast && slide.overflowCount > 0;
        return (
          <Capsule
            key={i}
            slot={slot}
            imagePath={recipient?.headshotPath ?? "/headshots/computer.png"}
            fallbackInitial={recipient?.fullName?.[0]?.toUpperCase()}
            badgeText={showBadge ? `+${slide.overflowCount}` : undefined}
          />
        );
      })}
    </>
  );
}

function StickerLayer({ stickers }: { stickers: StickerPlacement[] }) {
  return (
    <>
      {stickers.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: s.position.left,
            top: s.position.top,
            width: s.position.width,
            height: s.position.height,
            display: "flex",
          }}
        >
          <img
            src={imageSrc(s.imagePath)}
            width={s.position.width}
            height={s.position.height}
            style={{
              width: s.position.width,
              height: s.position.height,
              objectFit: "contain",
            }}
          />
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// public entry
// ---------------------------------------------------------------------------

export function renderSlideJsx(
  slide: WinSlide,
  stickers: StickerPlacement[],
): ReactElement {
  return (
    <div
      style={{
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        backgroundColor: TOKENS.bg,
        position: "relative",
        display: "flex",
      }}
    >
      <HeadshotGrid slide={slide} />
      <StickerLayer stickers={stickers} />
      <RightPanel message={slide.message} senderFullName={slide.sender.fullName} />
    </div>
  );
}

export const SLIDE_DIMENSIONS = { width: SLIDE_WIDTH, height: SLIDE_HEIGHT };
