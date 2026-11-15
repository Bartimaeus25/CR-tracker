import type { Metadata } from "next";
import { MatchHistory } from "@/components/dashboard/match-history";
import { DataNotes, PageHeading } from "@/components/dashboard/ui";
import { getDashboardData } from "@/lib/dashboard/data";

export const metadata: Metadata = { title: "Match history · Rivalry" };

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; player?: string }>;
}) {
  const data = await getDashboardData("all");
  const query = await searchParams;
  const player = data.players.some((value) => value.tag === query.player)
    ? query.player
    : "all";
  return (
    <>
      <PageHeading
        title="Match history"
        description="Browse recorded matches by player, result, and game mode."
        lastCollected={data.lastCollected}
      />
      <section className="panel history-panel full-history">
        <MatchHistory
          key={`${player}-${query.scope ?? "direct"}`}
          matches={data.matches}
          players={data.players}
          initialPlayer={player}
          initialScope={query.scope}
        />
      </section>
      <DataNotes data={data} />
    </>
  );
}
