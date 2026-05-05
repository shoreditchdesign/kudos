import localFont from "next/font/local";

// Cabinet Grotesk loaded for the browser. Same `.otf` files are also read
// by the Satori slide renderer (lib/render/fonts.ts). Exposed as the CSS
// variable --font-cabinet so it can be referenced from globals.css's
// @theme block as a Tailwind font utility (`font-cabinet`).
export const cabinetGrotesk = localFont({
  src: [
    { path: "../public/fonts/CabinetGrotesk-Regular.otf", weight: "400", style: "normal" },
    { path: "../public/fonts/CabinetGrotesk-Medium.otf", weight: "500", style: "normal" },
    { path: "../public/fonts/CabinetGrotesk-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-cabinet",
  display: "swap",
});
