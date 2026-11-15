"use client";
import Link from "next/link";
import { useState } from "react";
import type { DashboardData } from "@/lib/dashboard/types";
import { ModeFilter } from "./mode-filter";
import { PerformanceChart } from "./performance-chart";
import { RivalryCardLab, RivalryHighlights } from "./rivalry-card-lab";
import { Comparison, RivalryHero, RivalryStreaks, SectionHeading } from "./ui";
import { MatchHistory } from "./match-history";
import { DeckAnalytics } from "./deck-analytics";

export function RivalryOverview({ data }: { data: DashboardData }) {
  const [mode, setMode] = useState("all");
  const selected = {
    ...data,
    matches:
      mode === "all"
        ? data.matches
        : data.matches.filter((match) => match.mode === mode),
  };
  return (
    <>
      <p className="scope-explainer">
        Only matches between both players.{" "}
        <Link href="/stats">See all-opponent stats →</Link>
      </p>
      <ModeFilter matches={data.matches} selected={mode} onChange={setMode} />
      <RivalryHero data={selected} />
      <div className="performance-grid">
        <PerformanceChart matches={selected.matches} players={data.players} />
        <RivalryStreaks data={selected} />
      </div>
      <RivalryHighlights matches={selected.matches} players={data.players} />
      <Comparison data={selected} />
      <RivalryCardLab matches={selected.matches} players={data.players} />
      <section className="panel history-panel">
        <SectionHeading
          title="Recent rivalry matches"
          description={`${mode === "all" ? "All modes" : mode} · ${selected.matches.length} recorded matches`}
          href="/matches?scope=direct"
          action="Match history"
        />
        <MatchHistory
          key={mode}
          matches={selected.matches}
          players={data.players}
          initialScope="direct"
          compact
        />
      </section>
      <section className="section-block">
        <SectionHeading
          title="Most-used rivalry decks"
          description="Recorded head-to-head games and duel rounds"
          href="/decks?scope=direct"
          action="Deck analytics"
        />
        <DeckAnalytics
          matches={selected.matches}
          players={data.players}
          compact
        />
      </section>
    </>
  );
}
