"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Droplets, Layers3 } from "lucide-react";
import {
  displayDecimal,
  displayRate,
  playerPath,
} from "@/lib/dashboard/format";
import { deckStats, matchupStats } from "@/lib/dashboard/stats";
import type { Match, Player } from "@/lib/dashboard/types";
import { DeckCards, EmptyState } from "./ui";

export function DeckAnalytics({
  matches,
  players,
  compact = false,
  initialPlayer,
}: {
  matches: Match[];
  players: Player[];
  compact?: boolean;
  initialPlayer?: string;
}) {
  const [selected, setSelected] = useState(initialPlayer ?? "all");
  const visiblePlayers = players.filter(
    (player) => selected === "all" || selected === player.tag,
  );
  return (
    <div className="deck-analytics">
      {!compact && (
        <div className="deck-controls">
          <div className="segmented-control" aria-label="Deck player filter">
            <button
              aria-pressed={selected === "all"}
              onClick={() => setSelected("all")}
              type="button"
            >
              Both players
            </button>
            {players.map((player, index) => (
              <button
                key={player.tag}
                aria-pressed={selected === player.tag}
                onClick={() => setSelected(player.tag)}
                type="button"
              >
                <span className={`player-dot player-color-${index}`} />
                {player.name}
              </button>
            ))}
          </div>
          <span className="muted small">
            Unordered card IDs · 1v1 games & duel rounds
          </span>
        </div>
      )}
      <div
        className={
          compact || visiblePlayers.length === 2
            ? "two-column"
            : "deck-single-column"
        }
      >
        {visiblePlayers.map((player) => {
          const index = players.findIndex((value) => value.tag === player.tag);
          const decks = deckStats(matches, player.tag);
          return (
            <section
              className={`panel deck-player accent-${index}`}
              key={player.tag}
            >
              <div className="deck-player-heading">
                <span className={`player-dot player-color-${index}`} />
                <h3>{player.name}</h3>
                <span>
                  {decks.length} {decks.length === 1 ? "deck" : "decks"}
                </span>
              </div>
              {decks.length ? (
                decks
                  .slice(0, compact ? 1 : undefined)
                  .map((deck, deckIndex) => (
                    <article key={deck.key} className="deck-entry">
                      <div className="deck-entry-heading">
                        <strong>
                          {compact || deckIndex === 0
                            ? "Most played deck"
                            : `Deck · ${deck.played} games`}
                        </strong>
                        <span className="elixir-label">
                          <Droplets size={12} />
                          {displayDecimal(deck.elixir)} avg.
                        </span>
                      </div>
                      <DeckCards cards={deck.cards} />
                      <div className="deck-performance">
                        <div>
                          <strong>{deck.played}</strong>
                          <span>GAMES / ROUNDS</span>
                        </div>
                        <div>
                          <strong className="win-text">
                            {deck.wins}
                            <small>W</small>
                            <span className="loss-text">
                              {deck.losses}
                              <small>L</small>
                            </span>
                          </strong>
                          <span>{deck.draws} DRAWS</span>
                        </div>
                        <div>
                          <strong
                            className={index === 0 ? "blue-text" : "gold-text"}
                          >
                            {displayRate(deck.winRate)}
                          </strong>
                          <span>WIN RATE · n={deck.played}</span>
                        </div>
                      </div>
                    </article>
                  ))
              ) : (
                <EmptyState
                  title="No eligible decks yet"
                  description="A complete eight-card deck from a supported match will appear here."
                  icon="shield"
                />
              )}
              {compact && (
                <Link
                  className="deck-view-link"
                  href={`/decks?player=${encodeURIComponent(player.tag)}`}
                >
                  Explore {player.name}&apos;s decks <ArrowRight size={14} />
                </Link>
              )}
            </section>
          );
        })}
      </div>
      {!compact && (
        <section className="panel matchup-panel">
          <div className="panel-heading">
            <span className="icon-tile">
              <Layers3 size={18} />
            </span>
            <div>
              <h2>Deck matchups</h2>
              <p>
                Observed performance · minimum 3 games or duel rounds per
                pairing
              </p>
            </div>
          </div>
          {visiblePlayers.map((player) => {
            const matchups = matchupStats(matches, player.tag);
            return (
              <div className="player-matchups" key={player.tag}>
                <Link
                  href={playerPath(player.tag)}
                  className="matchup-player-label"
                >
                  {player.name}
                  <ArrowRight size={13} />
                </Link>
                {matchups.length ? (
                  matchups.map((matchup) => (
                    <article className="deck-matchup" key={matchup.key}>
                      <div>
                        <span className="muted small">
                          {player.name}&apos;s deck
                        </span>
                        <DeckCards cards={matchup.cards} compact />
                      </div>
                      <strong className="deck-matchup-vs">vs</strong>
                      <div>
                        <span className="muted small">Opponent deck</span>
                        <DeckCards cards={matchup.opponentCards} compact />
                      </div>
                      <div className="matchup-result">
                        <strong>{displayRate(matchup.winRate)}</strong>
                        <span>
                          {matchup.wins}W · {matchup.losses}L · {matchup.draws}D
                        </span>
                        <small>
                          {matchup.played} games
                          {matchup.played < 10
                            ? " · early sample"
                            : " · observed sample"}
                        </small>
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    icon="shield"
                    title="More repeat matchups needed"
                    description="No deck pairing has three scored games or duel rounds yet. Matchup results will appear as the sample grows."
                  />
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
