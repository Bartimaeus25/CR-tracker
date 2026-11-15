"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Crown,
  SlidersHorizontal,
  Swords,
} from "lucide-react";
import { displayDate, displayTime } from "@/lib/dashboard/format";
import { isDirectMatch, perspective } from "@/lib/dashboard/stats";
import type { Match, Player } from "@/lib/dashboard/types";
import { DeckCards, EmptyState } from "./ui";

const labels = {
  win: "Victory",
  loss: "Defeat",
  draw: "Draw",
  unscored: "Unscored",
};

export function MatchHistory({
  matches,
  players,
  compact = false,
  initialPlayer = "all",
  initialScope = "direct",
}: {
  matches: Match[];
  players: Player[];
  compact?: boolean;
  initialPlayer?: string;
  initialScope?: string;
}) {
  const [player, setPlayer] = useState(initialPlayer);
  const [scope, setScope] = useState(initialScope === "all" ? "all" : "direct");
  const [result, setResult] = useState("all");
  const [mode, setMode] = useState("all");
  const [page, setPage] = useState(1);
  const modes = [...new Set(matches.map((match) => match.mode))].sort();
  const selected = matches.flatMap((match) => {
    if (
      scope === "direct" &&
      !isDirectMatch(match, players[0].tag, players[1].tag)
    )
      return [];
    const focal =
      player === "all"
        ? players.find((tracked) =>
            match.participants.some(
              (participant) => participant.tag === tracked.tag,
            ),
          )?.tag
        : player;
    const view = focal ? perspective(match, focal) : null;
    if (!view || (mode !== "all" && match.mode !== mode)) return [];
    const outcome = view.result ?? "unscored";
    if (result !== "all" && result !== outcome) return [];
    return [{ match, view, outcome }];
  });
  const perPage = compact ? 5 : 12;
  const pages = Math.max(1, Math.ceil(selected.length / perPage));
  const visible = selected.slice((page - 1) * perPage, page * perPage);
  const update = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="match-history">
      {!compact && (
        <div className="match-filters">
          <div className="segmented-control" aria-label="Match scope">
            <button
              type="button"
              aria-pressed={scope === "all"}
              onClick={() => update(setScope, "all")}
            >
              All matches
            </button>
            <button
              type="button"
              aria-pressed={scope === "direct"}
              onClick={() => update(setScope, "direct")}
            >
              <Swords size={13} />
              Head to head
            </button>
          </div>
          <div className="select-filters">
            <SlidersHorizontal size={15} aria-hidden="true" />
            <label>
              <span className="sr-only">Filter by player</span>
              <select
                value={player}
                onChange={(event) => update(setPlayer, event.target.value)}
              >
                <option value="all">Both players</option>
                {players.map((value) => (
                  <option value={value.tag} key={value.tag}>
                    {value.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by result</span>
              <select
                value={result}
                onChange={(event) => update(setResult, event.target.value)}
              >
                <option value="all">All results</option>
                {Object.entries(labels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by game mode</span>
              <select
                value={mode}
                onChange={(event) => update(setMode, event.target.value)}
              >
                <option value="all">All modes</option>
                {modes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
      <div className="match-table-head" aria-hidden="true">
        <span>RESULT</span>
        <span>MATCHUP</span>
        <span>CROWNS</span>
        <span>DECK</span>
        <span>PLAYED</span>
        <span />
      </div>
      {visible.length ? (
        <div className="match-list">
          {visible.map(({ match, view, outcome }) => {
            const opponent = view.opponents
              .map((value) => value.name)
              .join(" & ");
            const opponentCrowns = view.opponents.length
              ? Math.max(...view.opponents.map((value) => value.crowns))
              : null;
            const direct = isDirectMatch(match, players[0].tag, players[1].tag);
            return (
              <Link
                href={`/matches/${match.id}`}
                className={`match-row result-${outcome}`}
                key={match.id}
              >
                <div className="match-result">
                  <span className={`result-label ${outcome}`}>
                    {labels[outcome as keyof typeof labels]}
                  </span>
                  {view.player.trophyChange !== null && (
                    <span
                      className={
                        view.player.trophyChange >= 0 ? "win-text" : "loss-text"
                      }
                    >
                      {view.player.trophyChange > 0 ? "+" : ""}
                      {view.player.trophyChange} trophies
                    </span>
                  )}
                </div>
                <div className="matchup-names">
                  <strong>
                    {view.player.name}
                    <span className="versus-label">vs</span>
                    <span>{opponent || "Opponent unavailable"}</span>
                  </strong>
                  <span>
                    {direct && <Swords size={11} />}
                    {match.mode}
                    {direct && <span className="direct-indicator">Direct</span>}
                  </span>
                </div>
                <div className="crown-score">
                  <Crown size={13} />
                  <span className="crown-values">
                    <strong>
                      {view.player.crowns}
                      <span>–</span>
                      {opponentCrowns ?? "—"}
                    </strong>
                    {match.isDuel && view.games.length > 0 && (
                      <small>
                        {
                          view.games.filter((game) => game.result === "win")
                            .length
                        }
                        –
                        {
                          view.games.filter((game) => game.result === "loss")
                            .length
                        }{" "}
                        rounds
                      </small>
                    )}
                  </span>
                </div>
                <div className="match-deck">
                  <DeckCards
                    cards={
                      view.player.rounds[0]?.cards ??
                      (match.isDuel ? [] : view.player.cards)
                    }
                    compact
                  />
                  {view.player.rounds.length > 0 && (
                    <small>First-round deck</small>
                  )}
                </div>
                <div className="match-time">
                  <time dateTime={match.time}>{displayTime(match.time)}</time>
                  <span>{displayDate(match.time)}</span>
                </div>
                <ArrowRight size={16} className="match-arrow" />
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No matches in this view"
          description="Try another player, result, or game mode. Only collected matches are shown."
        />
      )}
      {!compact && (
        <div className="match-pagination">
          <span>
            {selected.length
              ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, selected.length)} of ${selected.length} matches`
              : "0 matching records"}
            <small>Results follow the player shown first.</small>
          </span>
          <div>
            <button
              type="button"
              className="button button-icon"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              {page} / {pages}
            </span>
            <button
              type="button"
              className="button button-icon"
              aria-label="Next page"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
