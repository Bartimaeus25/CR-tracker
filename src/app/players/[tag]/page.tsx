import { AdvancedAnalytics } from "@/components/dashboard/advanced-analytics";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DeckAnalytics } from "@/components/dashboard/deck-analytics";
import { MatchHistory } from "@/components/dashboard/match-history";
import {
  PerformanceChart,
  TrophyChart,
} from "@/components/dashboard/performance-chart";
import {
  Chests,
  CurrentDeck,
  DataNotes,
  PageHeading,
  MatchScope,
  PlayerSummary,
  SectionHeading,
} from "@/components/dashboard/ui";
import { getDashboardData } from "@/lib/dashboard/data";
import { playerPath } from "@/lib/dashboard/format";

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ scope?: string }>;
}) {
  const { tag } = await params;
  const query = await searchParams;
  const data = await getDashboardData(query.scope === "all" ? "all" : "direct", `#${tag.replace(/^#/, "").toUpperCase()}`);
  const index = data.players.findIndex(
    (player) =>
      player.tag.replace(/^#/, "").toUpperCase() ===
      tag.replace(/^#/, "").toUpperCase(),
  );
  if (index < 0) notFound();
  const player = data.players[index];
  const other = data.players[1 - index];
  return (
    <>
      <Link href="/players" className="back-link">
        <ArrowLeft size={14} />
        All players
      </Link>
      <PageHeading
        title={player.name}
        description={`${player.tag} · ${player.arena ?? "Arena unavailable"}`}
        lastCollected={player.lastCollected}
      />
      <MatchScope scope={data.scope} href={playerPath(player.tag)} />
      <div className="two-column">
        <PlayerSummary
          player={player}
          other={other}
          matches={data.matches}
          index={index}
        />
        <CurrentDeck player={player} />
      </div>
      <div className="two-column section-block">
        <PerformanceChart
          matches={data.matches}
          players={data.players}
          variant={data.scope === "direct" ? "rivalry" : "overall"}
        />
        <TrophyChart
          observations={data.observations}
          player={player}
          index={index}
        />
      </div>
      <AdvancedAnalytics
        key={data.scope}
        matches={data.matches}
        players={data.players}
        initialPlayer={player.tag}
      />
      <section className="panel history-panel">
        <SectionHeading
          title={`${player.name}’s recent matches`}
          description={
            data.scope === "direct"
              ? "Matches against the other tracked player"
              : "All collected modes · unscored matches are labelled"
          }
          href={`/matches?player=${encodeURIComponent(player.tag)}&scope=${data.scope}`}
        />
        <MatchHistory
          key={`${player.tag}-${data.scope}`}
          matches={data.matches}
          players={data.players}
          initialPlayer={player.tag}
          initialScope={data.scope}
          compact
        />
      </section>
      <section className="section-block">
        <SectionHeading
          title="Favorite decks"
          description="Ranked by recorded use in scored 1v1 matches"
        />
        <DeckAnalytics
          matches={data.matches}
          players={data.players}
          initialPlayer={player.tag}
        />
      </section>
      <section className="section-block" id="chests">
        <SectionHeading
          title="Upcoming chests"
          description="Full available sequence · positions start at 1"
        />
        <Chests player={player} index={index} full />
      </section>
      <p className="player-compare-link">
        Continue the comparison{" "}
        <Link href={playerPath(other.tag)}>{other.name}’s profile →</Link>
      </p>
      <DataNotes data={data} />
    </>
  );
}
