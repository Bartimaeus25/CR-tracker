import type { Metadata } from "next";
import "@fontsource-variable/geist";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import { DashboardShell } from "@/components/dashboard/shell";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clash Royale Rivalry Tracker",
  description:
    "Real match history, deck insights, and head-to-head statistics for two Clash Royale rivals.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
