import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Kudos",
  description: "Weekly wins, ready to paste into Figma.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // The `dark` class on <html> activates the dark palette defined in
  // globals.css. Drop it (or swap to a system-preference toggle) if you
  // want light mode — every shadcn token has both variants.
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
