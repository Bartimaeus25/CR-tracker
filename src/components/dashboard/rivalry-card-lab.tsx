"use client";
import { useState } from "react";
import { Layers3, Flame, Crown, Sparkles } from "lucide-react";
import { advancedStats, playerStats } from "@/lib/dashboard/stats";
import { rivalryFacts } from "@/lib/dashboard/trends";
import { displayRate } from "@/lib/dashboard/format";
import type { Card, Match, Player } from "@/lib/dashboard/types";
import { CardArtwork } from "./artwork";
import { EmptyState, SectionHeading } from "./ui";

type RecordStats = ReturnType<typeof advancedStats>["cards"][number];

function PlayerRecord({
  record,
  total,
  index,
}: {
  record?: RecordStats;
  total: number;
  index: number;
}) {
  if (!record)
    return (
      <div className="lab-player-record muted">
        Not used in {total} eligible games/rounds
      </div>
    );
  return (
    <div className={`lab-player-record lab-player-${index}`}>
      <div className="lab-record-head">
        <strong>
          {displayRate(record.winRate)} <small>win rate</small>
        </strong>
        <span>
          {record.played < 10 ? "Early sample" : `${record.played} appearances`}
        </span>
      </div>
      <div className="lab-usage">
        <span>Usage {displayRate(record.usageRate)}</span>
        <span>
          {record.played}/{total}
        </span>
        <i>
          <b style={{ width: `${record.usageRate}%` }} />
        </i>
      </div>
      <small>
        {record.wins}W · {record.losses}L · {record.draws}D ·{" "}
        {record.averageCrowns.toFixed(2)} crowns/game
      </small>
      {record.currentUnbeaten >= 3 && (
        <span className="lab-streak">
          <Flame size={12} />
          Unbeaten in last {record.currentUnbeaten} scored appearances
        </span>
      )}
    </div>
  );
}

export function RivalryCardLab({
  matches,
  players,
}: {
  matches: Match[];
  players: Player[];
}) {
  const [kind, setKind] = useState<"cards" | "pairs">("cards");
  const [minimum, setMinimum] = useState(3);
  const [sort, setSort] = useState("usage");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const stats = players.map((player) => advancedStats(matches, player.tag));
  const rows = new Map<
    string,
    { key: string; cards: Card[]; records: (RecordStats | undefined)[] }
  >();
  stats.forEach((value, index) => {
    for (const record of value[kind]) {
      const row = rows.get(record.key) ?? {
        key: record.key,
        cards: record.cards,
        records: [undefined, undefined],
      };
      row.records[index] = record;
      rows.set(record.key, row);
    }
  });
  const eligible = [...rows.values()].filter(
    (row) =>
      Math.max(...row.records.map((value) => value?.played ?? 0)) >= minimum &&
      row.cards.some((card) =>
        card.name.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  const score = (row: (typeof eligible)[number]) => {
    const qualified = row.records.filter(
      (value): value is RecordStats => !!value && value.played >= minimum,
    );
    if (sort === "crowns")
      return Math.max(...qualified.map((value) => value.averageCrowns));
    if (sort === "wins")
      return Math.max(...qualified.map((value) => value.winRate));
    if (sort === "losses")
      return -Math.min(...qualified.map((value) => value.winRate));
    if (sort === "unbeaten")
      return Math.max(...qualified.map((value) => value.currentUnbeaten));
    if (sort === "edge")
      return row.records.every((value) => value && value.played >= minimum)
        ? Math.abs(row.records[0]!.winRate - row.records[1]!.winRate)
        : -1;
    return row.records.reduce((sum, value) => sum + (value?.played ?? 0), 0);
  };
  eligible.sort((a, b) => score(b) - score(a) || a.key.localeCompare(b.key));
  return (
    <section className="panel rivalry-lab section-block">
      <div className="panel-heading">
        <span className="icon-tile">
          <Layers3 size={18} />
        </span>
        <div>
          <h2>Head-to-head card lab</h2>
          <p>
            The same cards, compared side by side · follows the mode filter
            above
          </p>
        </div>
      </div>
      <div className="lab-controls">
        <div className="segmented-control" aria-label="Card or pair comparison">
          {(["cards", "pairs"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={kind === value}
              onClick={() => {
                setKind(value);
                setExpanded(false);
              }}
            >
              {value === "cards" ? "Cards" : "Two-card pairs"}
            </button>
          ))}
        </div>
        <label>
          Search cards
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Card name"
          />
        </label>
        <label>
          Sort by
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="usage">Most used</option>
            <option value="wins">Highest win rate</option>
            <option value="losses">Lowest win rate</option>
            <option value="edge">Win-rate difference</option>
            <option value="crowns">Crown output</option>
            <option value="unbeaten">Current unbeaten run</option>
          </select>
        </label>
        <label>
          Minimum sample
          <select
            value={minimum}
            onChange={(event) => setMinimum(Number(event.target.value))}
          >
            {[1, 3, 5, 10, 20].map((value) => (
              <option key={value} value={value}>
                {value} games/rounds
              </option>
            ))}
          </select>
        </label>
      </div>
      {eligible.length ? (
        <div className="lab-table-wrap">
          <table className="lab-table">
            <thead>
              <tr>
                <th>{kind === "cards" ? "Card" : "Pair"}</th>
                {players.map((player, index) => (
                  <th
                    key={player.tag}
                    className={index ? "gold-text" : "blue-text"}
                  >
                    {player.name}
                    <small>
                      {stats[index].eligibleGames} eligible games/rounds ·{" "}
                      {displayRate(stats[index].baseline)} baseline
                    </small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eligible.slice(0, expanded ? undefined : 12).map((row) => {
                const [a, b] = row.records;
                const edge =
                  a && b && a.played >= minimum && b.played >= minimum
                    ? a.winRate - b.winRate
                    : null;
                return (
                  <tr key={row.key}>
                    <th scope="row">
                      <div className="lab-card-name">
                        <span className="insight-art">
                          {row.cards.map((card) => (
                            <CardArtwork card={card} key={card.id} />
                          ))}
                        </span>
                        <strong>
                          {row.cards.map((card) => card.name).join(" + ")}
                        </strong>
                      </div>
                      {edge !== null && (
                        <small>
                          {edge === 0
                            ? "Win rates tied"
                            : `${players[edge > 0 ? 0 : 1].name} +${Math.abs(edge).toFixed(1)} percentage points`}
                        </small>
                      )}
                    </th>
                    {row.records.map((record, index) => (
                      <td key={players[index].tag}>
                        <PlayerRecord
                          record={record}
                          total={stats[index].eligibleGames}
                          index={index}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No qualifying card records"
          description="Try another mode, card name or sample threshold. Rankings need valid eight-card decks."
        />
      )}
      {eligible.length > 12 && (
        <button
          type="button"
          className="button button-secondary"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show fewer" : `Show all ${eligible.length} ${kind}`}
        </button>
      )}
      <p className="panel-footnote">
        Usage = appearances ÷ eligible games/rounds for that player. The sample
        threshold must be met by at least one player; win-rate differences
        require both. Under ten appearances is an early sample. Draws count in
        win-rate denominators. Unbeaten runs include draws and count successive
        scored appearances of that card/pair; games without it do not count.
      </p>
      <details className="lab-methodology">
        <summary>What can these comparisons tell us?</summary>
        <p>
          Win rates and crowns are outcomes of whole decks, influenced by
          opponents and modes. Pairs are observed combinations, not proof of
          synergy. Levels and evolutions are grouped by card ID. Draft, mirror,
          random and preset decks are excluded. Card damage is not captured;
          crowns cannot establish how much damage an individual card dealt.
        </p>
      </details>
    </section>
  );
}

export function RivalryHighlights({
  matches,
  players,
}: {
  matches: Match[];
  players: Player[];
}) {
  return (
    <section className="section-block">
      <SectionHeading
        title="Rivalry stories"
        description="Patterns in recorded head-to-head games · selected mode only"
      />
      <div className="rivalry-stories">
        {players.flatMap((player, index) => {
          const stats = advancedStats(matches, player.tag);
          const facts = rivalryFacts(matches, player.tag);
          const streak = [...stats.cards]
            .filter((card) => card.currentUnbeaten >= 3)
            .sort(
              (a, b) =>
                b.currentUnbeaten - a.currentUnbeaten ||
                b.played - a.played ||
                a.key.localeCompare(b.key),
            )[0];
          const mode = stats.modes
            .filter((value) => value.scored >= 3 && value.wins > 0)
            .sort(
              (a, b) =>
                b.wins / b.scored - a.wins / a.scored || b.scored - a.scored,
            )[0];
          const recent = playerStats(matches, player.tag);
          return [
            {
              title: "A card on a run",
              value: streak
                ? `${streak.currentUnbeaten} unbeaten`
                : "A run is building",
              detail: streak
                ? `${streak.cards[0].name} · ${streak.currentWins} consecutive wins at the end of this run. Counts recorded scored appearances, including draws.`
                : "Three successive scored appearances without a loss will unlock a card story.",
              icon: Flame,
            },
            {
              title: "Bounce-back factor",
              value: `${facts.bouncebacks} responses`,
              detail: `Wins immediately after a recorded match/series loss. ${facts.sweeps} two-round duel sweeps; ${facts.firstRoundConversions}/${facts.firstRoundWins} series won after taking round one.`,
              icon: Sparkles,
            },
            {
              title: mode
                ? `Best mode · ${mode.name.split(" · ")[0]}`
                : "Recorded winning streak",
              value: mode
                ? displayRate((mode.wins / mode.scored) * 100)
                : `${recent.longestWinStreak} wins`,
              detail: mode
                ? `${mode.wins} wins in ${mode.scored} scored matches/series. Minimum three; ties possible${mode.scored < 10 ? "; early sample" : ""}.`
                : "Longest winning streak in the selected view. Draws and unscored matches break the streak.",
              icon: Crown,
            },
          ].map(({ title, value, detail, icon: Icon }) => (
            <article
              className={`panel story-card accent-${index}`}
              key={`${player.tag}-${title}`}
            >
              <span className={`player-dot player-color-${index}`} />
              <small>{player.name}</small>
              <Icon size={18} />
              <h3>{title}</h3>
              <strong>{value}</strong>
              <p>{detail}</p>
            </article>
          ));
        })}
      </div>
    </section>
  );
}
