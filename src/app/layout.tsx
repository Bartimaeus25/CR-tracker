import type { Metadata } from "next";
import "@fontsource-variable/geist";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import { DashboardShell } from "@/components/dashboard/shell";
import { ComparisonSelector } from "@/components/dashboard/comparison-selector";
import { getComparison } from "@/lib/dashboard/data";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clash Royale Rivalry Tracker",
  description:
    "Real match history, deck insights, and head-to-head statistics for two Clash Royale rivals.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pair = await getComparison();
  const comparisonKey = pair.map((player) => player.tag).join(",");
  return (
    <html lang="en">
      <body>
        <DashboardShell>
          <ComparisonSelector key={comparisonKey} pair={pair.map((player) => player.tag)} />
          <div key={comparisonKey}>{children}</div>
        </DashboardShell>
      </body>
    </html>
  );
}
