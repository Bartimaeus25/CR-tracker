import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Crown, Swords } from "lucide-react";
import { DeckCards, PageHeading } from "@/components/dashboard/ui";
import { getDashboardData } from "@/lib/dashboard/data";
import {
  averageElixir,
  isDirectMatch,
  perspective,
} from "@/lib/dashboard/stats";
import {
  displayDate,
  displayDecimal,
  displayNumber,
  playerPath,
} from "@/lib/dashboard/format";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getDashboardData("all");
  const match = data.matches.find((value) => value.id === id);
  if (!match) notFound();
  const direct = isDirectMatch(match, data.players[0].tag, data.players[1].tag);
  return (
    <>
      <Link href="/matches" className="back-link">
        <ArrowLeft size={14} />
        Match history
      </Link>
      <PageHeading
        title={direct ? "A rivalry encounter" : "Match details"}
        description={`${match.mode} · ${displayDate(match.time, true)} · Berlin`}
      />
      <section className="panel match-detail-overview">
        <span className="icon-tile gold">
          <Swords size={23} />
        </span>
        <div>
          <h2>
            {match.participants
              .filter((player) => player.side === 0)
              .map((player) => player.name)
              .join(" & ")}{" "}
            <span className="muted">vs</span>{" "}
            {match.participants
              .filter((player) => player.side === 1)
              .map((player) => player.name)
              .join(" & ")}
          </h2>
          <p>
            {match.rated
              ? match.isDuel
                ? "Best-of-three duel · series result determined by round wins"
                : "Scored 1v1 match"
              : "This event or team mode is visible in history and excluded from performance statistics."}
            {direct ? " · Direct head-to-head" : ""}
          </p>
        </div>
      </section>
      <div className="two-column match-detail-sides">
        {[0, 1].map((side) => (
          <section className={`panel match-side accent-${side}`} key={side}>
            {match.participants
              .filter((player) => player.side === side)
              .map((player) => {
                const view = perspective(match, player.tag);
                const tracked = data.players.some(
                  (value) => value.tag === player.tag,
                );
                return (
                  <article key={player.tag}>
                    <div className="match-side-heading">
                      <div>
                        <span className="player-tag">{player.tag}</span>
                        {tracked ? (
                          <Link href={playerPath(player.tag)}>
                            <h2>{player.name}</h2>
                          </Link>
                        ) : (
                          <h2>{player.name}</h2>
                        )}
                      </div>
                      <span
                        className={`result-label ${view?.result ?? "unscored"}`}
                      >
                        {view?.result === "win"
                          ? "Victory"
                          : view?.result === "loss"
                            ? "Defeat"
                            : view?.result === "draw"
                              ? "Draw"
                              : "Unscored"}
                      </span>
                    </div>
                    <div className="detail-crowns">
                      <Crown size={24} />
                      <strong>
                        {match.isDuel && view?.result
                          ? view.games.filter((game) => game.result === "win")
                              .length
                          : player.crowns}
                      </strong>
                      <span>
                        {match.isDuel && view?.result
                          ? `rounds won · ${player.crowns} total crowns`
                          : "crowns"}
                      </span>
                    </div>
                    {player.rounds.length ? (
                      player.rounds.map((round, roundIndex) => (
                        <div className="duel-round" key={roundIndex}>
                          <h3 className="duel-round-heading">
                            Round {roundIndex + 1}
                            <span>
                              {round.crowns}–
                              {view?.opponents[0]?.rounds[roundIndex]?.crowns ??
                                "—"}{" "}
                              crowns
                            </span>
                          </h3>
                          <DeckCards cards={round.cards} />
                          <div className="deck-footer">
                            <span className="elixir-label">
                              ◆ {displayDecimal(averageElixir(round.cards))}{" "}
                              average elixir
                            </span>
                          </div>
                          <dl className="detail-metrics">
                            <div>
                              <dt>King tower HP</dt>
                              <dd>{displayNumber(round.kingTowerHitPoints)}</dd>
                            </div>
                            <div>
                              <dt>Elixir leaked</dt>
                              <dd>{displayDecimal(round.elixirLeaked)}</dd>
                            </div>
                          </dl>
                        </div>
                      ))
                    ) : (
                      <>
                        {match.isDuel && (
                          <p className="panel-footnote">
                            Individual round details are unavailable. The cards
                            below are the aggregate API list.
                          </p>
                        )}
                        <DeckCards cards={player.cards} />
                        {!match.isDuel && (
                          <div className="deck-footer">
                            <span className="elixir-label">
                              ◆ {displayDecimal(averageElixir(player.cards))}{" "}
                              average elixir
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    <dl className="detail-metrics">
                      <div>
                        <dt>Trophy change</dt>
                        <dd>
                          {player.trophyChange !== null &&
                          player.trophyChange > 0
                            ? "+"
                            : ""}
                          {displayNumber(player.trophyChange)}
                        </dd>
                      </div>
                      {!match.isDuel && (
                        <div>
                          <dt>King tower HP</dt>
                          <dd>{displayNumber(player.kingTowerHitPoints)}</dd>
                        </div>
                      )}
                      {!match.isDuel && (
                        <div>
                          <dt>Elixir leaked</dt>
                          <dd>{displayDecimal(player.elixirLeaked)}</dd>
                        </div>
                      )}
                    </dl>
                  </article>
                );
              })}
          </section>
        ))}
      </div>
      <section className="panel match-metadata">
        <h3>Recorded match information</h3>
        <dl>
          <div>
            <dt>Game mode</dt>
            <dd>{match.rawMode || match.mode}</dd>
          </div>
          <div>
            <dt>Battle type</dt>
            <dd>{match.type}</dd>
          </div>
          <div>
            <dt>Played</dt>
            <dd>{displayDate(match.time, true)} · Europe/Berlin</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
