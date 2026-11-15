"use client";

import { useState } from "react";
import { Crown, Sparkles, Layers3 } from "lucide-react";
import { advancedStats } from "@/lib/dashboard/stats";
import { displayRate } from "@/lib/dashboard/format";
import type { Match, Player } from "@/lib/dashboard/types";
import { CardArtwork } from "./artwork";
import { EmptyState, SectionHeading } from "./ui";

type RecordRow = ReturnType<typeof advancedStats>["cards"][number];

function Records({
  title,
  rows,
  baseline,
}: {
  title: string;
  rows: RecordRow[];
  baseline: number | null;
}) {
  return (
    <section className="insight-records">
      <h4>{title}</h4>
      {rows.length ? (
        rows.map((row) => (
          <div className="insight-record" key={row.key}>
            <div className="insight-art">
              {row.cards.map((card) => (
                <CardArtwork key={card.id} card={card} />
              ))}
            </div>
            <div className="insight-record-name">
              <strong>{row.cards.map((card) => card.name).join(" + ")}</strong>
              <small>
                {row.wins}W · {row.losses}L · {row.draws}D · {row.played}{" "}
                games/rounds{row.played < 10 ? " · Early sample" : ""}
              </small>
            </div>
            <div className="insight-rate">
              <strong>{displayRate(row.winRate)}</strong>
              <small>
                {baseline === null
                  ? ""
                  : `${row.winRate - baseline >= 0 ? "+" : ""}${(row.winRate - baseline).toFixed(1)} pp vs baseline`}
              </small>
            </div>
          </div>
        ))
      ) : (
        <p className="panel-footnote">
          No records meet the selected sample threshold. Try another mode or
          collect more games/rounds.
        </p>
      )}
    </section>
  );
}

export function AdvancedAnalytics({
  matches,
  players,
  initialPlayer,
}: {
  matches: Match[];
  players: Player[];
  initialPlayer?: string;
}) {
  const [tag, setTag] = useState(initialPlayer ?? players[0].tag);
  const [mode, setMode] = useState("all");
  const [minimum, setMinimum] = useState(3);
  const player = players.find((value) => value.tag === tag) ?? players[0];
  const index = players.findIndex((value) => value.tag === player.tag);
  const all = advancedStats(matches, player.tag);
  const filtered =
    mode === "all"
      ? matches
      : matches.filter(
          (match) => `${match.type}/${match.modeId ?? match.rawMode}` === mode,
        );
  const stats = advancedStats(filtered, player.tag);
  const cards = stats.cards.filter((row) => row.played >= minimum);
  const pairs = stats.pairs.filter((row) => row.played >= minimum);
  const reverse = (rows: RecordRow[]) =>
    [...rows].sort(
      (a, b) =>
        a.winRate - b.winRate ||
        b.played - a.played ||
        a.key.localeCompare(b.key),
    );
  const distinct = (rows: RecordRow[]) =>
    new Set(rows.map((row) => row.winRate)).size > 1;
  const facts = [
    {
      name: "Crowns earned",
      value: stats.crowns,
      detail: `${stats.conceded} conceded · ${stats.games} games/rounds`,
      icon: Crown,
    },
    {
      name: "Clean wins",
      value: stats.shutouts,
      detail: "Wins without conceding a crown",
      icon: Crown,
    },
    {
      name: "Three-crown wins",
      value: stats.threeCrowns,
      detail: "Games finishing with three crowns",
      icon: Crown,
    },
    {
      name: "Comeback series",
      value: stats.comebacks,
      detail: "Duel wins after losing round one",
      icon: Sparkles,
    },
    {
      name: "Deciding rounds",
      value: `${stats.deciders.filter((result) => result === "win").length}/${stats.deciders.length}`,
      detail: "Third-round wins after a 1–1 start",
      icon: Sparkles,
    },
    {
      name: "One-crown wins",
      value: stats.closestWins,
      detail: "Games won by exactly one crown",
      icon: Sparkles,
    },
  ];
  return (
    <section
      className="section-block advanced-analytics"
      id="advanced-analytics"
    >
      <SectionHeading
        title="Inside the rivalry"
        description="Cards, combinations, crowns & the moments that matter"
      />
      <div className="analytics-controls">
        <div className="segmented-control" aria-label="Analytics player">
          {players.map((value, i) => (
            <button
              key={value.tag}
              type="button"
              aria-pressed={player.tag === value.tag}
              onClick={() => {
                setTag(value.tag);
                setMode("all");
              }}
            >
              <span className={`player-dot player-color-${i}`} />
              {value.name}
            </button>
          ))}
        </div>
        <label className="chart-select">
          Game mode{" "}
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value="all">All modes in this scope</option>
            {all.modes.map((row) => (
              <option value={row.key} key={row.key}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="achievement-grid">
        {facts.map(({ name, value, detail, icon: Icon }) => (
          <article className={`panel achievement accent-${index}`} key={name}>
            <Icon size={18} />
            <span>{name}</span>
            <strong>{value}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </div>
      <p className="chart-footnote">
        Crowns are the game’s tower score; destroying the king tower awards
        three crowns. Duel rounds count individually. Damage totals are
        unavailable in the captured data: remaining tower HP alone cannot
        establish damage dealt.
      </p>
      <section className={`panel card-insights accent-${index}`}>
        <div className="chart-heading">
          <div className="panel-heading">
            <span className="icon-tile">
              <Layers3 size={18} />
            </span>
            <div>
              <h2>{player.name} · card lab</h2>
              <p>
                {stats.eligibleGames} eligible games/rounds · baseline{" "}
                {displayRate(stats.baseline)}
              </p>
            </div>
          </div>
          <label className="chart-select">
            Minimum sample{" "}
            <select
              value={minimum}
              onChange={(event) => setMinimum(Number(event.target.value))}
            >
              {[3, 5, 10, 20].map((value) => (
                <option value={value} key={value}>
                  {value} games/rounds
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="panel-footnote">
          Win rate when a card or pair appears in the deck. These are deck
          associations, influenced by the other cards and opponents. They do not
          measure a card’s damage or prove synergy. Levels and evolutions are
          grouped by card ID; draws count in the denominator. Baseline is this
          player’s win rate across all eligible games in the selected mode.
          Differences are in percentage points (pp).
        </p>
        <div className="two-column">
          <Records
            title={
              !cards.length
                ? "Card records"
                : distinct(cards)
                  ? "Highest card win rates"
                  : "Card records · tied win rates"
            }
            rows={cards.slice(0, 4)}
            baseline={stats.baseline}
          />
          {distinct(cards) && (
            <Records
              title="Lowest card win rates"
              rows={reverse(cards).slice(0, 4)}
              baseline={stats.baseline}
            />
          )}
          <Records
            title={
              !pairs.length
                ? "Pair records"
                : distinct(pairs)
                  ? "Highest pair win rates"
                  : "Pair records · tied win rates"
            }
            rows={pairs.slice(0, 3)}
            baseline={stats.baseline}
          />
          {distinct(pairs) && (
            <Records
              title="Lowest pair win rates"
              rows={reverse(pairs).slice(0, 3)}
              baseline={stats.baseline}
            />
          )}
        </div>
        <p className="panel-footnote">
          Samples below ten games/rounds are early observations. Draft, random,
          mirror and preset decks are excluded. Rankings show at most four cards
          and three pairs per end; equal rates can tie.
        </p>
      </section>
      <section className="panel mode-insights">
        <div className="panel-heading">
          <h2>{player.name} · by game mode</h2>
        </div>
        <p className="panel-footnote">
          All modes in the selected head-to-head / all-opponents scope. Win
          rates use matches or duel series; crowns use individual games/rounds.
        </p>
        {all.modes.length ? (
          <div className="mode-table-wrap">
            <table className="mode-table">
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>Recorded / scored</th>
                  <th>W / L / D</th>
                  <th>Win rate</th>
                  <th>Crowns for / against</th>
                </tr>
              </thead>
              <tbody>
                {all.modes.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.name}</th>
                    <td>
                      {row.played} / {row.scored}
                    </td>
                    <td>
                      {row.wins} / {row.losses} / {row.draws}
                    </td>
                    <td>
                      {displayRate(
                        row.scored ? (row.wins / row.scored) * 100 : null,
                      )}
                      {row.scored > 0 && row.scored < 10 && (
                        <small>Early sample</small>
                      )}
                    </td>
                    <td>
                      {row.games
                        ? `${row.crowns} / ${row.conceded}`
                        : "Unscored"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Mode history is building"
            description="Collected matches will appear here, including modes excluded from scoring."
          />
        )}
      </section>
    </section>
  );
}
