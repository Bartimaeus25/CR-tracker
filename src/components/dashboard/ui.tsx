import Link from "next/link";
import {
  ArrowRight,
  Box,
  Crown,
  Flame,
  Shield,
  Swords,
  Trophy,
} from "lucide-react";
import {
  displayDate,
  displayDecimal,
  displayNumber,
  displayRate,
  playerPath,
} from "@/lib/dashboard/format";
import { averageElixir, headToHead, playerStats } from "@/lib/dashboard/stats";
import type {
  Card,
  DashboardData,
  Match,
  Player,
  Result,
} from "@/lib/dashboard/types";
import { CardArtwork, PlayerAvatar } from "./artwork";

export function PageHeading({
  title,
  description,
  lastCollected,
}: {
  title: string;
  description: string;
  lastCollected?: string | null;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {lastCollected && (
        <div className="collection-time">
          <span className="status-dot" />
          <span>
            Last collected
            <strong>{displayDate(lastCollected, true)} · Berlin</strong>
          </span>
        </div>
      )}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  href,
  action = "View all",
}: {
  title: string;
  description?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {href && (
        <Link className="text-link" href={href}>
          {action}
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}

export function MatchScope({
  scope,
  href,
}: {
  scope: "direct" | "all";
  href: string;
}) {
  return (
    <nav className="match-scope-links" aria-label="Statistics match scope">
      {(["direct", "all"] as const).map((value) => (
        <Link
          key={value}
          href={`${href}${href.includes("?") ? "&" : "?"}scope=${value}`}
          className={`button ${scope === value ? "button-primary" : "button-secondary"}`}
          aria-current={scope === value ? "true" : undefined}
        >
          {value === "direct" ? "Head to head" : "All opponents"}
        </Link>
      ))}
    </nav>
  );
}

export function EmptyState({
  title,
  description,
  icon = "swords",
}: {
  title: string;
  description: string;
  icon?: "swords" | "box" | "shield";
}) {
  const Icon = icon === "box" ? Box : icon === "shield" ? Shield : Swords;
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={25} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function DeckCards({
  cards,
  compact = false,
}: {
  cards: Card[];
  compact?: boolean;
}) {
  return cards.length ? (
    <div className={`deck-cards ${compact ? "compact" : ""}`}>
      {cards.map((card, index) => (
        <CardArtwork key={`${card.id}-${index}`} card={card} />
      ))}
    </div>
  ) : (
    <p className="muted small">Deck information unavailable.</p>
  );
}

export function RecentForm({ results }: { results: (Result | null)[] }) {
  if (!results.length)
    return <span className="muted">No recorded matches</span>;
  return (
    <span className="recent-form" aria-label="Recent results, latest first">
      {results.map((result, index) => (
        <span
          key={index}
          className={`form-result ${result ?? "unknown"}`}
          title={`${index === 0 ? "Latest match" : `Match ${index + 1}`}: ${result ?? "unscored"}`}
        >
          {result === "win"
            ? "W"
            : result === "loss"
              ? "L"
              : result === "draw"
                ? "D"
                : "·"}
        </span>
      ))}
    </span>
  );
}

export function RivalryHero({ data }: { data: DashboardData }) {
  const [first, second] = data.players;
  const h2h = headToHead(data.matches, first.tag, second.tag);
  const hasScore = h2h.first.scored > 0;
  const leader =
    h2h.first.wins > h2h.second.wins
      ? first
      : h2h.second.wins > h2h.first.wins
        ? second
        : null;
  return (
    <section
      className="rivalry-hero"
      aria-label="Direct head-to-head comparison"
    >
      {data.players.map((player, index) => {
        const overall = playerStats(data.matches, player.tag);
        return (
          <div key={player.tag} className={`hero-player player-${index}`}>
            <div className="hero-profile">
              <PlayerAvatar image={player.avatar} name={player.name} large />
              <div>
                <span className="player-tag">
                  {player.tag}
                  {player.level !== null && (
                    <span className="level-label">LV. {player.level}</span>
                  )}
                </span>
                <Link className="hero-name" href={playerPath(player.tag)}>
                  {player.name}
                  <ArrowRight size={19} />
                </Link>
                <span className="hero-clan">
                  <Shield size={13} />
                  {player.clan ?? "Clan unavailable"}
                </span>
              </div>
            </div>
            {player.hasProfile ? (
              <>
                <div className="hero-trophies">
                  <Trophy size={26} />
                  <strong>{displayNumber(player.trophies)}</strong>
                  <span>trophies</span>
                </div>
                <div className="hero-record">
                  <span>
                    Personal best{" "}
                    <strong>{displayNumber(player.bestTrophies)}</strong>
                  </span>
                  <span>{player.arena ?? "Arena unavailable"}</span>
                </div>
              </>
            ) : (
              <p className="muted">Awaiting a collected profile.</p>
            )}
            <div className="hero-overall">
              <span>
                {data.scope === "direct" ? "Head to head" : "Overall"} ·{" "}
                {overall.total} recorded · {overall.scored} scored
              </span>
              <div>
                <strong>
                  {overall.wins}
                  <small>W</small>
                </strong>
                <strong>
                  {overall.losses}
                  <small>L</small>
                </strong>
                <strong>
                  {overall.draws}
                  <small>D</small>
                </strong>
                <b>{displayRate(overall.winRate)}</b>
              </div>
            </div>
            <Link href={playerPath(player.tag)} className="hero-profile-link">
              Player profile <ArrowRight size={14} />
            </Link>
          </div>
        );
      })}
      <div className="hero-score">
        <span className="eyebrow">DIRECT HEAD TO HEAD</span>
        {hasScore ? (
          <>
            <div className="rivalry-score">
              <strong className="blue-text">{h2h.first.wins}</strong>
              <span>:</span>
              <strong className="gold-text">{h2h.second.wins}</strong>
            </div>
            <span className="score-caption">
              {h2h.matches.length} direct matches · {h2h.first.scored} scored ·{" "}
              {h2h.first.draws} draws
            </span>
            <div
              className="rivalry-split"
              aria-label={`${first.name} ${displayRate(h2h.first.winRate)} win rate; ${second.name} ${displayRate(h2h.second.winRate)} win rate`}
            >
              <span style={{ flex: h2h.first.wins }} />
              <span className="split-draw" style={{ flex: h2h.first.draws }} />
              <span style={{ flex: h2h.second.wins }} />
            </div>
            <div className="score-rates">
              <strong
                className="blue-text"
                aria-label={`${first.name} direct win rate`}
              >
                {displayRate(h2h.first.winRate)}
              </strong>
              <span>WIN RATE</span>
              <strong
                className="gold-text"
                aria-label={`${second.name} direct win rate`}
              >
                {displayRate(h2h.second.winRate)}
              </strong>
            </div>
            <span className="rivalry-leader">
              <Crown size={13} />
              {leader ? `${leader.name} leads` : "The rivalry is tied"}
            </span>
          </>
        ) : (
          <>
            <div className="hero-no-score">
              <Swords size={38} strokeWidth={1.2} />
            </div>
            <strong>
              {h2h.matches.length
                ? "No scored head-to-head matches yet."
                : "No head-to-head matches recorded yet."}
            </strong>
            <span className="score-caption">
              {h2h.matches.length
                ? `${h2h.matches.length} direct matches use unsupported scoring modes.`
                : "Direct matches will appear when the players face each other."}
            </span>
          </>
        )}
      </div>
    </section>
  );
}

export function RivalryStreaks({ data }: { data: DashboardData }) {
  const [first, second] = data.players;
  const h2h = headToHead(data.matches, first.tag, second.tag);
  const streak = h2h.first.streak;
  const winner =
    streak?.result === "win"
      ? first
      : streak?.result === "loss"
        ? second
        : null;
  return (
    <section className="panel streak-panel">
      <div className="panel-heading">
        <span className="icon-tile gold">
          <Flame size={18} />
        </span>
        <h2>Rivalry momentum</h2>
      </div>
      {h2h.first.scored ? (
        <>
          <div className="streak-headline">
            <strong>
              {winner ? streak?.count : "—"}
              <span>{winner ? "WIN STREAK" : "NO ACTIVE WIN STREAK"}</span>
            </strong>
            <Flame size={47} strokeWidth={1} />
          </div>
          <p className="streak-owner">
            {winner?.name ??
              (streak?.result === "draw"
                ? "Latest direct duel was a draw"
                : "Latest direct match is unscored")}
          </p>
          <div className="streak-records">
            {data.players.map((player, index) => (
              <div key={player.tag}>
                <span className={`player-dot player-color-${index}`} />
                <span>
                  {player.name}
                  <small>Longest winning streak</small>
                </span>
                <strong>
                  {index === 0
                    ? h2h.first.longestWinStreak
                    : h2h.second.longestWinStreak}
                </strong>
              </div>
            ))}
          </div>
          <Link className="text-link" href="/matches?scope=direct">
            Explore direct matches <ArrowRight size={15} />
          </Link>
        </>
      ) : (
        <EmptyState
          title="A streak starts with a duel"
          description="Direct wins and winning streaks will appear after a supported head-to-head match."
        />
      )}
    </section>
  );
}

export function Comparison({ data }: { data: DashboardData }) {
  const stats = data.players.map((player) =>
    playerStats(data.matches, player.tag),
  );
  const rows = [
    {
      label: "Recorded matches",
      values: stats.map((value) => displayNumber(value.total)),
    },
    {
      label: "Scored 1v1 matches",
      values: stats.map((value) => displayNumber(value.scored)),
    },
    {
      label: "Games, including duel rounds",
      values: stats.map((value) => displayNumber(value.games)),
    },
    {
      label: "Wins / losses / draws",
      values: stats.map(
        (value) => `${value.wins} / ${value.losses} / ${value.draws}`,
      ),
    },
    {
      label: "Win rate",
      values: stats.map((value) => displayRate(value.winRate)),
      highlight: true,
    },
    {
      label: "Crowns earned / conceded per game",
      values: stats.map(
        (value) =>
          `${displayDecimal(value.averageCrowns)} / ${displayDecimal(value.averageConceded)}`,
      ),
    },
    {
      label: "Total crowns earned / conceded",
      values: stats.map((value) => `${value.crowns} / ${value.conceded}`),
    },
    {
      label: "Three-crown games won",
      values: stats.map((value) => displayNumber(value.threeCrowns)),
    },
    {
      label: "Current recorded streak",
      values: stats.map((value) =>
        value.streak
          ? `${value.streak.count} ${value.streak.result === "win" ? "wins" : value.streak.result === "loss" ? "losses" : "draws"}`
          : "Unavailable",
      ),
    },
    {
      label: "Current / best trophies",
      values: data.players.map(
        (player) =>
          `${displayNumber(player.trophies)} / ${displayNumber(player.bestTrophies)}`,
      ),
    },
  ];
  return (
    <section className="panel comparison-panel">
      <SectionHeading
        title={
          data.scope === "direct"
            ? "Head-to-head performance"
            : "Overall performance"
        }
        description={
          data.scope === "direct"
            ? "Matches between both players · supported 1v1 matches"
            : "Against every opponent · supported 1v1 matches"
        }
      />
      <div className="comparison-table">
        <div className="comparison-header">
          <span>IN THE STORED WINDOW</span>
          {data.players.map((player, index) => (
            <Link href={playerPath(player.tag)} key={player.tag}>
              <span className={`player-dot player-color-${index}`} />
              {player.name}
            </Link>
          ))}
        </div>
        {rows.map((row) => (
          <div
            className={`comparison-row ${row.highlight ? "comparison-highlight" : ""}`}
            key={row.label}
          >
            <span>{row.label}</span>
            {row.values.map((value, index) => (
              <strong
                key={index}
                className={
                  row.highlight ? (index === 0 ? "blue-text" : "gold-text") : ""
                }
              >
                {value}
                {row.highlight && (
                  <span className="comparison-bar">
                    <i style={{ width: `${stats[index].winRate ?? 0}%` }} />
                  </span>
                )}
              </strong>
            ))}
          </div>
        ))}
        <div className="comparison-row form-comparison">
          <span>
            Recent form<small>Latest first</small>
          </span>
          {stats.map((value, index) => (
            <RecentForm key={index} results={value.recent} />
          ))}
        </div>
      </div>
      <p className="panel-footnote">
        Win rate = wins ÷ scored matches, including duel series and draws. Crown
        averages use individual games and duel rounds.{" "}
        {stats.reduce((sum, value) => sum + value.excluded, 0)} player
        appearances in event or unsupported modes are excluded from performance
        statistics.
      </p>
    </section>
  );
}

export function Chests({
  player,
  index,
  full = false,
}: {
  player: Player;
  index: number;
  full?: boolean;
}) {
  return (
    <section className={`panel chests-panel accent-${index}`}>
      <div className="chest-heading">
        <span className="icon-tile">
          <Box size={19} />
        </span>
        <div>
          <h3>{player.name}</h3>
          <span>Upcoming chest cycle</span>
        </div>
        {!full && (
          <Link className="text-link" href={`${playerPath(player.tag)}#chests`}>
            Full cycle <ArrowRight size={14} />
          </Link>
        )}
      </div>
      {player.chests.length ? (
        <>
          <div className={`chest-list ${full ? "full-cycle" : ""}`}>
            {player.chests.slice(0, full ? undefined : 5).map((chest) => (
              <div className="chest-item" key={`${chest.index}-${chest.name}`}>
                <span
                  className={`chest-art ${chest.index === 0 ? "next-chest" : ""}`}
                >
                  <Box size={28} strokeWidth={1.3} />
                </span>
                <strong>{chest.name}</strong>
                <span>
                  {chest.index === 0
                    ? "NEXT CHEST"
                    : `POSITION ${chest.index + 1}`}
                </span>
              </div>
            ))}
          </div>
          <p className="panel-footnote">
            Positions follow the API chest cycle. Last collected{" "}
            {player.chestsCollected
              ? displayDate(player.chestsCollected, true)
              : "time unavailable"}
            .
          </p>
        </>
      ) : (
        <EmptyState
          icon="box"
          title="No chest sequence available"
          description="The next successful chest collection will appear here."
        />
      )}
    </section>
  );
}

export function PlayerSummary({
  player,
  other,
  matches,
  index,
}: {
  player: Player;
  other: Player;
  matches: Match[];
  index: number;
}) {
  const stats = playerStats(matches, player.tag);
  const direct = headToHead(matches, player.tag, other.tag);
  return (
    <section className={`panel player-summary accent-${index}`}>
      <div className="profile-summary-top">
        <PlayerAvatar image={player.avatar} name={player.name} large />
        <div>
          <span className="player-tag">{player.tag}</span>
          <h2>{player.name}</h2>
          <p>
            <Shield size={13} />
            {player.clan ?? "Clan unavailable"}
          </p>
        </div>
        <span className="profile-level">
          {player.level === null
            ? "Level unavailable"
            : `Level ${player.level}`}
        </span>
      </div>
      <div className="profile-stat-grid">
        <div>
          <Trophy size={18} />
          <strong>{displayNumber(player.trophies)}</strong>
          <span>Current trophies</span>
        </div>
        <div>
          <Crown size={18} />
          <strong>{displayRate(stats.winRate)}</strong>
          <span>{stats.scored} scored matches</span>
        </div>
        <div>
          <Swords size={18} />
          <strong>
            {stats.wins} <small>/ {stats.losses}</small>
          </strong>
          <span>Wins / losses · {stats.draws} draws</span>
        </div>
      </div>
      <div className="profile-meta">
        <span>
          Best <strong>{displayNumber(player.bestTrophies)}</strong>
        </span>
        <span>
          King tower <strong>{displayNumber(player.kingLevel)}</strong>
        </span>
        <span>
          Cards listed <strong>{displayNumber(player.cards)}</strong>
        </span>
      </div>
      <div className="profile-versus">
        <span>Direct vs {other.name}</span>
        <strong>
          {direct.first.scored
            ? `${direct.first.wins} wins · ${direct.first.losses} losses · ${direct.first.draws} draws`
            : "No scored direct matches"}
        </strong>
      </div>
      {!player.hasProfile && (
        <p className="panel-footnote">Profile awaiting its first collection.</p>
      )}
    </section>
  );
}

export function CurrentDeck({ player }: { player: Player }) {
  const elixir = averageElixir(player.deck);
  return (
    <section className="panel current-deck">
      <SectionHeading
        title="Current deck"
        description="From the latest stored player profile"
      />
      <DeckCards cards={player.deck} />
      <div className="deck-footer">
        <span className="elixir-label">
          ◆ {displayDecimal(elixir)} average elixir
        </span>
        <span>{player.deck.length} cards</span>
      </div>
    </section>
  );
}

export function DataNotes({ data }: { data: DashboardData }) {
  const oldest = data.matches.at(-1)?.time;
  const newest = data.matches[0]?.time;
  return (
    <details className="data-notes" id="data-notes">
      <summary>
        <Shield size={15} />
        About these statistics<span>Data window & calculation rules</span>
      </summary>
      <div>
        <p>
          Stored battle window{" "}
          {oldest && newest
            ? `${displayDate(oldest, true)} – ${displayDate(newest, true)}`
            : "awaiting collected matches"}
          . Collection started{" "}
          {data.collectionStarted
            ? displayDate(data.collectionStarted, true)
            : "time unavailable"}
          . Times use Europe/Berlin.
        </p>
        <p>
          Head-to-head requires the two tracked players on opposing sides.
          Overall statistics include every supported 1v1 opponent. Ranked,
          Trophy Road, friendly, challenge, tournament, and standard clan-war
          1v1 types are scored by crowns. Best-of-three duels use round wins,
          and a series is scored only when complete round data establishes a
          winner. Crown averages, three-crown wins, and deck statistics use
          individual games and duel rounds. Team and unrecognized event types
          remain visible as unscored matches.
        </p>
        <p>
          Win rates include draws in the denominator. Streaks cover recorded
          matches only and break on draws or unscored matches. Decks use
          unordered card IDs, independent of levels. Draft, random, mirror, and
          preset event decks are excluded from deck analytics. Matchup samples
          need at least three scored matches and describe observations only.
          Card and pair records use individual games and duel rounds, with a
          selectable sample threshold, defaulting to three appearances. Samples
          below ten are early observations; a pair’s win rate describes its
          whole deck and does not prove synergy. Mode win rates use matches or
          duel series. Crown totals use individual games and rounds. Damage
          cannot be calculated from remaining tower HP alone. Card/pair usage
          divides appearances by eligible games/rounds. Card unbeaten runs
          include draws and count only scored appearances of that card, while
          ordinary winning streaks break on draws. Performance bars use Berlin
          calendar periods; weeks start Monday. The overview is always head to
          head; Stats includes every opponent.
        </p>
        <p>
          The API supplies a recent battle window. Earlier matches are available
          only if they were captured. Profile trophies and observed trophy
          history are separate from match trophy changes. Refresh data fetches
          all tracked players from the API and updates the view. Collection is also
          scheduled hourly through Supabase Cron.
        </p>
      </div>
    </details>
  );
}
