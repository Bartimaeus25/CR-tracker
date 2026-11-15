import { DeckAnalytics } from "@/components/dashboard/deck-analytics";
import { MatchHistory } from "@/components/dashboard/match-history";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import {
  Chests,
  Comparison,
  DataNotes,
  PageHeading,
  MatchScope,
  RivalryHero,
  RivalryStreaks,
  SectionHeading,
} from "@/components/dashboard/ui";
import { getDashboardData } from "@/lib/dashboard/data";
import { displayDate } from "@/lib/dashboard/format";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const query = await searchParams;
  const data = await getDashboardData(query.scope === "all" ? "all" : "direct");
  const oldest = data.matches.at(-1)?.time;
  const newest = data.matches[0]?.time;
  const range =
    oldest && newest ? ` · ${displayDate(oldest)}–${displayDate(newest)}` : "";
  return (
    <>
      <PageHeading
        title="Rivalry overview"
        description={`${data.matches.length} ${data.scope === "direct" ? "head-to-head" : "unique stored"} matches${range}`}
        lastCollected={data.lastCollected}
      />
      <MatchScope scope={data.scope} href="/" />
      <RivalryHero data={data} />
      <div className="performance-grid">
        <PerformanceChart matches={data.matches} players={data.players} />
        <RivalryStreaks data={data} />
      </div>
      <Comparison data={data} />
      <section className="panel history-panel">
        <SectionHeading
          title="Recent matches"
          description={
            data.scope === "direct"
              ? "Latest matches between both players"
              : "Latest collected battles · all opponents"
          }
          href={`/matches?scope=${data.scope}`}
          action="Match history"
        />
        <MatchHistory
          key={data.scope}
          matches={data.matches}
          players={data.players}
          initialScope={data.scope}
          compact
        />
      </section>
      <section className="section-block">
        <SectionHeading
          title="Most-used decks"
          description="Most-played decks in scored 1v1 matches"
          href={`/decks?scope=${data.scope}`}
          action="Deck analytics"
        />
        <DeckAnalytics matches={data.matches} players={data.players} compact />
      </section>
      <section className="section-block">
        <SectionHeading
          title="Next in the chest cycle"
          description="Upcoming rewards for each player"
        />
        <div className="two-column">
          {data.players.map((player, index) => (
            <Chests key={player.tag} player={player} index={index} />
          ))}
        </div>
      </section>
      <DataNotes data={data} />
    </>
  );
}
