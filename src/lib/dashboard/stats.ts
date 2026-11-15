import type { Card, Match, Participant, Result } from "./types";

const supportedTypes = new Set([
  "pvp",
  "pathoflegend",
  "friendly",
  "challenge",
  "tournament",
  "riverracepvp",
  "riverraceduel",
  "riverraceduelcolosseum",
  "clanwarwarday",
]);

export function supportsScoring(
  type: string,
  participants: Participant[],
  isDuel = false,
): boolean {
  if (
    !supportedTypes.has(type.toLowerCase()) ||
    participants.length !== 2 ||
    participants.filter((player) => player.side === 0).length !== 1 ||
    participants.filter((player) => player.side === 1).length !== 1 ||
    participants[0].tag === participants[1].tag
  )
    return false;
  if (!isDuel)
    return participants.every(
      (player) => player.rounds.length === 0 && validCrowns(player.crowns),
    );

  const [first, second] = participants;
  if (
    first.rounds.length < 2 ||
    first.rounds.length > 3 ||
    first.rounds.length !== second.rounds.length ||
    !participants.every((player) =>
      player.rounds.every((round) => validCrowns(round.crowns)),
    )
  )
    return false;
  if (
    !participants.every(
      (player) =>
        player.crowns ===
        player.rounds.reduce((sum, round) => sum + round.crowns, 0),
    )
  )
    return false;
  if (
    first.rounds
      .slice(0, -1)
      .filter((round, index) => round.crowns > second.rounds[index].crowns)
      .length >= 2 ||
    second.rounds
      .slice(0, -1)
      .filter((round, index) => round.crowns > first.rounds[index].crowns)
      .length >= 2
  )
    return false;
  const firstWins = first.rounds.filter(
    (round, index) => round.crowns > second.rounds[index].crowns,
  ).length;
  const secondWins = second.rounds.filter(
    (round, index) => round.crowns > first.rounds[index].crowns,
  ).length;
  return (
    (firstWins === 2 && secondWins < 2) || (secondWins === 2 && firstWins < 2)
  );
}

function validCrowns(crowns: number): boolean {
  return Number.isInteger(crowns) && crowns >= 0 && crowns <= 3;
}

function crownResult(crowns: number, conceded: number): Result {
  if (crowns === conceded) return "draw";
  return crowns > conceded ? "win" : "loss";
}

export function isDirectMatch(
  match: Match,
  firstTag: string,
  secondTag: string,
): boolean {
  const first = match.participants.find((player) => player.tag === firstTag);
  const second = match.participants.find((player) => player.tag === secondTag);
  return (
    first !== undefined && second !== undefined && first.side !== second.side
  );
}

export function perspective(match: Match, tag: string) {
  const player = match.participants.find(
    (participant) => participant.tag === tag,
  );
  if (!player) return null;
  const opponents = match.participants.filter(
    (participant) => participant.side !== player.side,
  );
  let result: Result | null = null;
  const games: {
    crowns: number;
    conceded: number;
    cards: Card[];
    opponentCards: Card[];
    result: Result;
  }[] = [];
  if (match.rated && opponents.length === 1) {
    const opponent = opponents[0];
    const ownRounds = match.isDuel ? player.rounds : [player];
    const opponentRounds = match.isDuel ? opponent.rounds : [opponent];
    games.push(
      ...ownRounds.map((round, index) => ({
        crowns: round.crowns,
        conceded: opponentRounds[index].crowns,
        cards: round.cards,
        opponentCards: opponentRounds[index].cards,
        result: crownResult(round.crowns, opponentRounds[index].crowns),
      })),
    );
    result = match.isDuel
      ? crownResult(
          games.filter((game) => game.result === "win").length,
          games.filter((game) => game.result === "loss").length,
        )
      : games[0].result;
  }
  return { player, opponents, result, games };
}

export function playerMatches(matches: Match[], tag: string): Match[] {
  // Be defensive about duplicate rows and query ordering.
  return [
    ...new Map(
      matches
        .filter((match) =>
          match.participants.some((player) => player.tag === tag),
        )
        .map((match) => [match.id, match]),
    ).values(),
  ].sort(
    (left, right) =>
      Date.parse(right.time) - Date.parse(left.time) ||
      left.id.localeCompare(right.id),
  );
}

export function playerStats(matches: Match[], tag: string) {
  const recorded = playerMatches(matches, tag);
  const scored = recorded.flatMap((match) => {
    const view = perspective(match, tag);
    return view?.result ? [{ ...view, result: view.result, match }] : [];
  });
  const wins = scored.filter((view) => view.result === "win").length;
  const losses = scored.filter((view) => view.result === "loss").length;
  const draws = scored.length - wins - losses;
  const games = scored.flatMap((view) => view.games);
  const latest = recorded[0] ? perspective(recorded[0], tag)?.result : null;
  let streak = 0;
  let longestWinStreak = 0;
  let consecutiveWins = 0;
  for (const match of recorded) {
    if (perspective(match, tag)?.result !== latest || !latest) break;
    streak++;
  }
  for (const match of [...recorded].reverse()) {
    consecutiveWins =
      perspective(match, tag)?.result === "win" ? consecutiveWins + 1 : 0;
    longestWinStreak = Math.max(longestWinStreak, consecutiveWins);
  }
  return {
    total: recorded.length,
    scored: scored.length,
    excluded: recorded.length - scored.length,
    wins,
    losses,
    draws,
    winRate: scored.length ? (wins / scored.length) * 100 : null,
    crowns: games.reduce((sum, game) => sum + game.crowns, 0),
    conceded: games.reduce((sum, game) => sum + game.conceded, 0),
    averageCrowns: games.length
      ? games.reduce((sum, game) => sum + game.crowns, 0) / games.length
      : null,
    averageConceded: games.length
      ? games.reduce((sum, game) => sum + game.conceded, 0) / games.length
      : null,
    games: games.length,
    threeCrowns: games.filter(
      (game) => game.result === "win" && game.crowns === 3,
    ).length,
    streak: latest ? { result: latest, count: streak } : null,
    longestWinStreak,
    recent: recorded
      .slice(0, 10)
      .map((match) => perspective(match, tag)?.result ?? null),
  };
}

export function headToHead(
  matches: Match[],
  firstTag: string,
  secondTag: string,
) {
  const direct = matches.filter((match) =>
    isDirectMatch(match, firstTag, secondTag),
  );
  return {
    matches: playerMatches(direct, firstTag),
    first: playerStats(direct, firstTag),
    second: playerStats(direct, secondTag),
  };
}

export function deckKey(cards: Card[]): string | null {
  if (cards.length !== 8 || new Set(cards.map((card) => card.id)).size !== 8)
    return null;
  return cards
    .map((card) => card.id)
    .sort((left, right) => left - right)
    .join("-");
}

export function averageElixir(cards: Card[]): number | null {
  if (
    !cards.length ||
    cards.some((card) => card.elixir === null || card.elixir < 0)
  )
    return null;
  return (
    cards.reduce((sum, card) => sum + (card.elixir ?? 0), 0) / cards.length
  );
}

export interface DeckStats {
  key: string;
  cards: Card[];
  played: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  elixir: number | null;
  lastPlayed: string;
}

function allowsDeckAnalysis(match: Match) {
  return (
    match.rated && !/draft|random|eventdeck|mirror|mega/i.test(match.rawMode)
  );
}

export function deckStats(matches: Match[], tag: string): DeckStats[] {
  const decks = new Map<string, DeckStats>();
  for (const match of playerMatches(matches, tag)) {
    const view = perspective(match, tag);
    if (!view?.result || !allowsDeckAnalysis(match)) continue;
    for (const game of view.games) {
      const key = deckKey(game.cards);
      if (!key) continue;
      let deck = decks.get(key);
      if (!deck) {
        deck = {
          key,
          cards: game.cards,
          played: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0,
          elixir: averageElixir(game.cards),
          lastPlayed: match.time,
        };
        decks.set(key, deck);
      }
      deck.played++;
      if (game.result === "win") deck.wins++;
      if (game.result === "loss") deck.losses++;
      if (game.result === "draw") deck.draws++;
      deck.winRate = (deck.wins / deck.played) * 100;
    }
  }
  return [...decks.values()].sort(
    (left, right) =>
      right.played - left.played ||
      right.winRate - left.winRate ||
      left.key.localeCompare(right.key),
  );
}

export function matchupStats(matches: Match[], tag: string) {
  const groups = new Map<
    string,
    {
      cards: Card[];
      opponentCards: Card[];
      played: number;
      wins: number;
      losses: number;
      draws: number;
    }
  >();
  for (const match of playerMatches(matches, tag)) {
    const view = perspective(match, tag);
    if (!view?.result || !allowsDeckAnalysis(match)) continue;
    for (const game of view.games) {
      const ownKey = deckKey(game.cards);
      const opponentKey = deckKey(game.opponentCards);
      if (!ownKey || !opponentKey) continue;
      const key = `${ownKey}/${opponentKey}`;
      const group = groups.get(key) ?? {
        cards: game.cards,
        opponentCards: game.opponentCards,
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      };
      group.played++;
      if (game.result === "win") group.wins++;
      if (game.result === "loss") group.losses++;
      if (game.result === "draw") group.draws++;
      groups.set(key, group);
    }
  }
  return [...groups.entries()]
    .filter(([, group]) => group.played >= 3)
    .map(([key, group]) => ({
      key,
      ...group,
      winRate: (group.wins / group.played) * 100,
    }))
    .sort((left, right) => right.played - left.played);
}

export function rollingWinRates(
  matches: Match[],
  tags: string[],
  windowSize: number,
) {
  const points = new Map<
    number,
    {
      time: number;
      first?: number;
      second?: number;
      firstSample?: number;
      secondSample?: number;
    }
  >();
  for (const [index, tag] of tags.entries()) {
    const results: Result[] = [];
    for (const match of playerMatches(matches, tag).reverse()) {
      const result = perspective(match, tag)?.result;
      if (!result) continue;
      results.push(result);
      const window = results.slice(-windowSize);
      const time = Date.parse(match.time);
      const point = points.get(time) ?? { time };
      const rate =
        (window.filter((value) => value === "win").length / window.length) *
        100;
      if (index === 0) {
        point.first = rate;
        point.firstSample = window.length;
      }
      if (index === 1) {
        point.second = rate;
        point.secondSample = window.length;
      }
      points.set(time, point);
    }
  }
  return [...points.values()].sort((left, right) => left.time - right.time);
}

/** Game-level records: a duel contributes each round once, never its aggregate deck. */
export function advancedStats(matches: Match[], tag: string) {
  const recorded = playerMatches(matches, tag);
  const scored = recorded.flatMap((match) => {
    const view = perspective(match, tag);
    return view?.result ? [{ match, view }] : [];
  });
  const games = scored.flatMap(({ view }) => view.games);
  const eligible = scored
    .filter(({ match }) => allowsDeckAnalysis(match))
    .flatMap(({ view }) => view.games)
    .filter((game) => deckKey(game.cards));
  type RecordStats = {
    key: string;
    cards: Card[];
    played: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
  };
  const cards = new Map<string, RecordStats>();
  const pairs = new Map<string, RecordStats>();
  const add = (
    groups: Map<string, RecordStats>,
    groupCards: Card[],
    result: Result,
  ) => {
    const sorted = [...groupCards].sort((a, b) => a.id - b.id);
    const key = sorted.map((card) => card.id).join("-");
    const row = groups.get(key) ?? {
      key,
      cards: sorted,
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
    };
    row.played++;
    if (result === "win") row.wins++;
    if (result === "loss") row.losses++;
    if (result === "draw") row.draws++;
    row.winRate = (row.wins / row.played) * 100;
    groups.set(key, row);
  };
  for (const game of eligible) {
    for (const [index, card] of game.cards.entries()) {
      add(cards, [card], game.result);
      for (const second of game.cards.slice(index + 1))
        add(pairs, [card, second], game.result);
    }
  }
  const rank = (groups: Map<string, RecordStats>) =>
    [...groups.values()].sort(
      (a, b) =>
        b.winRate - a.winRate ||
        b.played - a.played ||
        a.key.localeCompare(b.key),
    );
  const modes = new Map<
    string,
    {
      key: string;
      name: string;
      played: number;
      scored: number;
      wins: number;
      losses: number;
      draws: number;
      crowns: number;
      conceded: number;
      games: number;
    }
  >();
  for (const match of recorded) {
    // Keep distinct API modes separate even when their friendly labels match.
    const key = `${match.type}/${match.modeId ?? match.rawMode}`;
    const row = modes.get(key) ?? {
      key,
      name: `${match.mode}${match.rawMode ? ` · ${match.rawMode.replaceAll("_", " ")}` : ""}`,
      played: 0,
      scored: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      crowns: 0,
      conceded: 0,
      games: 0,
    };
    row.played++;
    const view = perspective(match, tag);
    if (view?.result) {
      row.scored++;
      if (view.result === "win") row.wins++;
      if (view.result === "loss") row.losses++;
      if (view.result === "draw") row.draws++;
      for (const game of view.games) {
        row.crowns += game.crowns;
        row.conceded += game.conceded;
        row.games++;
      }
    }
    modes.set(key, row);
  }
  const duels = scored.filter(({ match }) => match.isDuel);
  return {
    cards: rank(cards),
    pairs: rank(pairs),
    eligibleGames: eligible.length,
    baseline: eligible.length
      ? (eligible.filter((game) => game.result === "win").length /
          eligible.length) *
        100
      : null,
    modes: [...modes.values()].sort(
      (a, b) => b.played - a.played || a.key.localeCompare(b.key),
    ),
    games: games.length,
    crowns: games.reduce((sum, game) => sum + game.crowns, 0),
    conceded: games.reduce((sum, game) => sum + game.conceded, 0),
    shutouts: games.filter(
      (game) => game.result === "win" && game.conceded === 0,
    ).length,
    threeCrowns: games.filter(
      (game) => game.result === "win" && game.crowns === 3,
    ).length,
    comebacks: duels.filter(
      ({ view }) => view.result === "win" && view.games[0].result === "loss",
    ).length,
    deciders: duels
      .filter(
        ({ view }) =>
          view.games.length === 3 &&
          view.games.slice(0, 2).filter((game) => game.result === "win")
            .length === 1 &&
          view.games.slice(0, 2).filter((game) => game.result === "loss")
            .length === 1,
      )
      .map(({ view }) => view.games[2].result),
    closestWins: games.filter(
      (game) => game.result === "win" && game.crowns - game.conceded === 1,
    ).length,
  };
}
