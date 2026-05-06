import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { satoshi } from "./fonts";

export const metadata: Metadata = {
  title: "Kudos",
  description: "Weekly wins, ready to paste into Figma.",
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // The `dark` class on <html> activates the dark palette defined in
  // globals.css. Drop it (or swap to a system-preference toggle) if you
  // want light mode — every shadcn token has both variants.
  return (
    <html lang="en" className={`dark ${satoshi.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
