"use client";
import { useState } from "react";
import { Crown, Trophy, Swords } from "lucide-react";
import { playerStats } from "@/lib/dashboard/stats";
import { displayNumber, displayRate } from "@/lib/dashboard/format";
import type { DashboardData } from "@/lib/dashboard/types";
import { ModeFilter } from "./mode-filter";
import { PerformanceChart, TrophyChart } from "./performance-chart";
import { Comparison, SectionHeading } from "./ui";
import { MatchHistory } from "./match-history";

export function OverallStats({ data }: { data: DashboardData }) {
  const [mode, setMode] = useState("all");
  const selected = {
    ...data,
    matches:
      mode === "all"
        ? data.matches
        : data.matches.filter((match) => match.mode === mode),
  };
  const ranked = data.matches.filter(
    (match) => match.type.toLowerCase() === "pathoflegend",
  );
  return (
    <div className="overall-stats">
      <p className="scope-explainer">
        Every collected opponent, including rivalry matches. The mode filter
        applies to match statistics; profile history is shown independently.
      </p>
      <ModeFilter matches={data.matches} selected={mode} onChange={setMode} />
      <div className="two-column section-block">
        {data.players.map((player, index) => {
          const stats = playerStats(selected.matches, player.tag);
          return (
            <section
              className={`panel stats-player accent-${index}`}
              key={player.tag}
            >
              <div className="panel-heading">
                <span className={`player-dot player-color-${index}`} />
                <h2>{player.name}</h2>
              </div>
              <div className="profile-stat-grid">
                <div>
                  <Trophy size={18} />
                  <strong>{displayNumber(player.trophies)}</strong>
                  <span>Current trophies</span>
                </div>
                <div>
                  <Swords size={18} />
                  <strong>{stats.total}</strong>
                  <span>Stored matches · selected mode</span>
                </div>
                <div>
                  <Crown size={18} />
                  <strong>{displayRate(stats.winRate)}</strong>
                  <span>
                    {stats.wins}W / {stats.losses}L / {stats.draws}D ·{" "}
                    {stats.scored} scored
                  </span>
                </div>
              </div>
            </section>
          );
        })}
      </div>
      <PerformanceChart
        matches={selected.matches}
        players={data.players}
        variant="overall"
      />
      <Comparison data={selected} />
      <section className="section-block">
        <SectionHeading
          title="Trophy development"
          description="Actual stored profile observations · all Trophy Road totals"
        />
        <div className="two-column">
          {data.players.map((player, index) => (
            <TrophyChart
              key={player.tag}
              observations={data.observations}
              player={player}
              index={index}
            />
          ))}
        </div>
      </section>
      <section className="section-block">
        <SectionHeading
          title="Ranked progress"
          description="Current season profile values and recorded Ranked matches · independent of the mode filter"
        />
        <div className="two-column">
          {data.players.map((player, index) => {
            const stats = playerStats(ranked, player.tag);
            return (
              <section
                className={`panel stats-player accent-${index}`}
                key={player.tag}
              >
                <h3>{player.name}</h3>
                <div className="ranked-metrics">
                  <div>
                    <span>Recorded league</span>
                    <strong>{displayNumber(player.rankedLeague)}</strong>
                  </div>
                  <div>
                    <span>Season rating</span>
                    <strong>
                      {player.rankedRating && player.rankedRating > 0
                        ? displayNumber(player.rankedRating)
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Ranked matches</span>
                    <strong>{stats.scored}</strong>
                  </div>
                  <div>
                    <span>Ranked win rate</span>
                    <strong>{displayRate(stats.winRate)}</strong>
                  </div>
                </div>
                <p className="panel-footnote">
                  {stats.wins}W / {stats.losses}L / {stats.draws}D in stored
                  scored Ranked matches. Missing or zero season ratings are not
                  plotted; season resets can change ratings independently of
                  match results.
                </p>
              </section>
            );
          })}
        </div>
        <div className="two-column section-block">
          {data.players.map((player, index) => (
            <TrophyChart
              metric="rankedRating"
              key={player.tag}
              observations={data.observations}
              player={player}
              index={index}
            />
          ))}
        </div>
      </section>
      <section className="panel history-panel">
        <SectionHeading
          title="Recent games · all opponents"
          description={mode === "all" ? "All recorded modes" : mode}
          href="/matches?scope=all"
          action="All match history"
        />
        <MatchHistory
          key={mode}
          matches={selected.matches}
          players={data.players}
          initialScope="all"
          compact
        />
      </section>
    </div>
  );
}
