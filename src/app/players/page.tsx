import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  CurrentDeck,
  DataNotes,
  PageHeading,
  MatchScope,
  PlayerSummary,
} from "@/components/dashboard/ui";
import { getDashboardData } from "@/lib/dashboard/data";
import { playerPath } from "@/lib/dashboard/format";

export const metadata: Metadata = { title: "Players · Rivalry" };

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const query = await searchParams;
  const data = await getDashboardData(query.scope === "all" ? "all" : "direct");
  return (
    <>
      <PageHeading
        title="The players"
        description="Compare recorded profiles, current decks, and match performance."
        lastCollected={data.lastCollected}
      />
      <MatchScope scope={data.scope} href="/players" />
      <div className="two-column players-grid">
        {data.players.map((player, index) => (
          <div className="player-column" key={player.tag}>
            <PlayerSummary
              player={player}
              other={data.players[1 - index]}
              matches={data.matches}
              index={index}
            />
            <CurrentDeck player={player} />
            <Link
              href={playerPath(player.tag)}
              className="button player-page-link"
            >
              Explore {player.name}
              <ArrowRight size={16} />
            </Link>
          </div>
        ))}
      </div>
      <DataNotes data={data} />
    </>
  );
}
