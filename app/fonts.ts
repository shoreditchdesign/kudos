import localFont from "next/font/local";

// Satoshi loaded for the browser. Drop additional weights at the paths below
// (Satoshi-Medium.otf, Satoshi-Bold.otf) and the loader will pick them up
// without further code changes — comment back in the entries.
//
// The Satori slide renderer (lib/render/fonts.ts) reads Cabinet Grotesk OTFs
// directly from public/fonts/ and is independent of this loader.
export const satoshi = localFont({
  src: [
    { path: "../public/fonts/Satoshi-Regular.otf", weight: "400", style: "normal" },
    // { path: "../public/fonts/Satoshi-Medium.otf", weight: "500", style: "normal" },
    // { path: "../public/fonts/Satoshi-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});
