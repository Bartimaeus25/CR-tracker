import type { Metadata } from "next";
import { DeckAnalytics } from "@/components/dashboard/deck-analytics";
import { DataNotes, MatchScope, PageHeading } from "@/components/dashboard/ui";
import { getDashboardData } from "@/lib/dashboard/data";

export const metadata: Metadata = { title: "Deck analytics · Rivalry" };

export default async function DecksPage({
  searchParams,
}: {
  searchParams: Promise<{ player?: string; scope?: string }>;
}) {
  const query = await searchParams;
  const data = await getDashboardData(query.scope === "all" ? "all" : "direct");
  const player = data.players.some((value) => value.tag === query.player)
    ? query.player
    : "all";
  return (
    <>
      <PageHeading
        title="Deck analytics"
        description="Find your most-played decks and see how they perform."
        lastCollected={data.lastCollected}
      />
      <MatchScope
        scope={data.scope}
        href={
          player === "all"
            ? "/decks"
            : `/decks?player=${encodeURIComponent(player ?? "all")}`
        }
      />
      <DeckAnalytics
        key={`${player}-${data.scope}`}
        matches={data.matches}
        players={data.players}
        initialPlayer={player}
      />
      <DataNotes data={data} />
    </>
  );
}
