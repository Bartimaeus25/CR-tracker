import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  averageElixir,
  deckKey,
  deckStats,
  headToHead,
  isDirectMatch,
  matchupStats,
  playerStats,
  rollingWinRates,
  supportsScoring,
} from "../src/lib/dashboard/stats";
import { readSupabaseRows } from "../src/lib/supabase";
import type { Card, Match, Participant } from "../src/lib/dashboard/types";

const firstTag = "#2CVGR2R8R";
const secondTag = "#9Q2PQLG0L";
const otherTag = "#P0Y";
const cards: Card[] = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  name: `Card ${index + 1}`,
  image: null,
  elixir: index % 2 ? 4 : 2,
  evolution: 0,
}));

function participant(
  tag: string,
  side: number,
  crowns: number,
  deck = cards,
): Participant {
  return {
    tag,
    name: tag,
    side,
    crowns,
    cards: deck,
    trophyChange: null,
    kingTowerHitPoints: null,
    elixirLeaked: null,
    rounds: [],
  };
}

function match(
  id: string,
  day: number,
  firstCrowns = 1,
  secondCrowns = 0,
  second = secondTag,
  type = "friendly",
): Match {
  const participants = [
    participant(firstTag, 0, firstCrowns),
    participant(second, 1, secondCrowns),
  ];
  return {
    id,
    time: `2026-11-${String(day).padStart(2, "0")}T12:00:00.000Z`,
    type,
    mode: "Friendly",
    rawMode: "Duel_1v1_Friendly",
    modeId: 1,
    rated: supportsScoring(type, participants),
    isDuel: false,
    participants,
  };
}

function duel(id: string, day: number, scores: [number, number][]): Match {
  const battle = match(id, day);
  battle.isDuel = true;
  for (const [side, player] of battle.participants.entries()) {
    player.cards = [];
    player.rounds = scores.map((score, index) => ({
      crowns: score[side],
      cards: cards.map((card) => ({ ...card, id: card.id + index * 10 })),
      kingTowerHitPoints: null,
      elixirLeaked: null,
    }));
    player.crowns = scores.reduce((sum, score) => sum + score[side], 0);
  }
  battle.rated = supportsScoring(battle.type, battle.participants, true);
  return battle;
}

test("duel series use round wins when aggregate crowns tie or favour the loser", () => {
  const tiedCrowns = duel("tied-crowns", 1, [
    [3, 1],
    [0, 1],
    [0, 1],
  ]);
  const misleadingCrowns = duel("misleading-crowns", 2, [
    [0, 1],
    [3, 0],
    [0, 1],
  ]);
  assert.equal(tiedCrowns.rated, true);
  assert.equal(misleadingCrowns.rated, true);
  const h2h = headToHead([tiedCrowns, misleadingCrowns], firstTag, secondTag);
  assert.equal(h2h.first.wins, 0);
  assert.equal(h2h.second.wins, 2);
  assert.equal(h2h.first.draws, 0);
  assert.equal(h2h.first.games, 6);
  assert.equal(h2h.first.averageCrowns, 1);
  assert.equal(h2h.first.threeCrowns, 2);
});

test("duel deck statistics use each round's deck and round result", () => {
  const battle = duel("duel", 1, [
    [0, 1],
    [3, 0],
    [0, 1],
  ]);
  const decks = deckStats([battle], firstTag);
  assert.equal(decks.length, 3);
  assert.equal(
    decks.reduce((sum, deck) => sum + deck.played, 0),
    3,
  );
  assert.equal(
    decks.find(
      (deck) => deck.key === deckKey(battle.participants[0].rounds[1].cards),
    )?.winRate,
    100,
  );
  assert.equal(
    decks.reduce((sum, deck) => sum + deck.wins, 0),
    1,
  );
});

test("incomplete or contradictory duel rounds stay unscored", () => {
  assert.equal(duel("incomplete", 1, [[1, 0]]).rated, false);
  assert.equal(
    duel("unfinished", 1, [
      [1, 0],
      [0, 1],
    ]).rated,
    false,
  );
  assert.equal(
    duel("extra-round", 1, [
      [1, 0],
      [1, 0],
      [0, 1],
    ]).rated,
    false,
  );
  const inconsistent = duel("inconsistent", 1, [
    [1, 0],
    [1, 0],
  ]);
  inconsistent.participants[0].crowns = 0;
  assert.equal(
    supportsScoring(inconsistent.type, inconsistent.participants, true),
    false,
  );
  const missingRounds = match("missing-rounds", 1);
  assert.equal(
    supportsScoring(missingRounds.type, missingRounds.participants, true),
    false,
  );
});

test("head-to-head includes opposing players and excludes unrelated matches and allies", () => {
  const direct = match("direct", 1);
  const unrelated = match("unrelated", 2, 1, 0, otherTag);
  const allies = {
    ...match("allies", 3),
    participants: [
      participant(firstTag, 0, 1),
      participant(secondTag, 0, 1),
      participant(otherTag, 1, 0),
    ],
    rated: false,
  };
  const h2h = headToHead(
    [direct, unrelated, allies, direct],
    firstTag,
    secondTag,
  );
  assert.equal(isDirectMatch(allies, firstTag, secondTag), false);
  assert.equal(h2h.matches.length, 1);
  assert.equal(h2h.first.wins, 1);
  assert.equal(h2h.second.losses, 1);
  assert.equal(
    playerStats([direct, unrelated, allies, direct], firstTag).total,
    3,
  );
});

test("draws count in the denominator and unsupported modes are excluded", () => {
  const matches = [
    match("win", 1, 3, 0),
    match("loss", 2, 0, 3),
    match("draw", 3, 1, 1),
    match("event", 4, 3, 0, secondTag, "trail"),
  ];
  const stats = playerStats(matches, firstTag);
  assert.equal(stats.total, 4);
  assert.equal(stats.scored, 3);
  assert.equal(stats.excluded, 1);
  assert.equal(stats.wins, 1);
  assert.equal(stats.losses, 1);
  assert.equal(stats.draws, 1);
  assert.ok(Math.abs((stats.winRate ?? 0) - 100 / 3) < 1e-10);
  assert.equal(stats.averageCrowns, 4 / 3);
  assert.equal(stats.averageConceded, 4 / 3);
  assert.equal(stats.threeCrowns, 1);
  assert.equal(stats.streak, null);
  assert.equal(stats.recent[0], null);
});

test("streaks use recorded chronology and break at draws or unscored matches", () => {
  const matches = [
    match("a", 1),
    match("b", 2),
    match("draw", 3, 1, 1),
    match("d", 4),
    match("event", 5, 1, 0, secondTag, "trail"),
    match("f", 6),
    match("g", 7),
  ];
  const stats = playerStats(matches.reverse(), firstTag);
  assert.deepEqual(stats.streak, { result: "win", count: 2 });
  assert.equal(stats.longestWinStreak, 2);
  assert.equal(
    playerStats([match("draw", 1, 0, 0)], firstTag).streak?.result,
    "draw",
  );
});

test("team matches and unknown event types cannot enter standard 1v1 scoring", () => {
  assert.equal(
    supportsScoring("friendly", [
      participant(firstTag, 0, 1),
      participant(secondTag, 0, 0),
    ]),
    false,
  );
  assert.equal(
    supportsScoring("friendly", [
      participant(firstTag, 0, 1),
      participant(secondTag, 1, 0),
      participant(otherTag, 1, 0),
    ]),
    false,
  );
  assert.equal(
    supportsScoring("newEvent", [
      participant(firstTag, 0, 1),
      participant(secondTag, 1, 0),
    ]),
    false,
  );
  assert.equal(
    supportsScoring("PvP", [
      participant(firstTag, 0, 1),
      participant(secondTag, 1, 0),
    ]),
    true,
  );
});

test("decks group unordered card IDs, use real costs, and exclude incomplete or preset decks", () => {
  const first = match("first", 1);
  const second = match("second", 2, 0, 1);
  second.participants[0].cards = [...cards]
    .reverse()
    .map((card) => ({ ...card, evolution: 1 }));
  const preset = { ...match("preset", 3), rawMode: "Challenge_EventDeck" };
  const decks = deckStats([first, second, preset], firstTag);
  assert.equal(decks.length, 1);
  assert.equal(decks[0].played, 2);
  assert.equal(decks[0].winRate, 50);
  assert.equal(decks[0].elixir, 3);
  assert.equal(deckKey(cards), deckKey([...cards].reverse()));
  assert.equal(deckKey(cards.slice(0, 7)), null);
  assert.equal(deckKey(Array(8).fill(cards[0])), null);
  assert.equal(averageElixir([{ ...cards[0], elixir: null }]), null);
  assert.equal(averageElixir([{ ...cards[0], elixir: -1 }]), null);
  assert.equal(averageElixir([{ ...cards[0], elixir: 0 }]), 0);
});

test("matchup samples require at least three matches and retain draws", () => {
  const first = match("first", 1);
  const second = match("second", 2, 0, 1);
  const third = match("third", 3, 1, 1);
  assert.deepEqual(matchupStats([first, second], firstTag), []);
  const groups = matchupStats([first, second, third], firstTag);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].played, 3);
  assert.equal(groups[0].wins, 1);
  assert.equal(groups[0].losses, 1);
  assert.equal(groups[0].draws, 1);
});

test("rolling rates expose sample sizes and use only preceding scored matches", () => {
  const matches = [
    match("a", 1),
    match("b", 2, 0, 1),
    match("event", 3, 1, 0, secondTag, "trail"),
    match("d", 4, 1, 1),
  ];
  const points = rollingWinRates(matches.reverse(), [firstTag, secondTag], 2);
  assert.equal(points.length, 3);
  assert.equal(points[0].first, 100);
  assert.equal(points[0].firstSample, 1);
  assert.equal(points[1].first, 50);
  assert.equal(points[2].first, 0);
  assert.equal(points[2].second, 50);
  assert.equal(points[2].firstSample, 2);
});

test("empty datasets use unavailable rates and streaks", () => {
  const stats = playerStats([], firstTag);
  assert.equal(stats.total, 0);
  assert.equal(stats.winRate, null);
  assert.equal(stats.averageCrowns, null);
  assert.equal(stats.streak, null);
  assert.deepEqual(deckStats([], firstTag), []);
  assert.equal(headToHead([], firstTag, secondTag).matches.length, 0);
});

test("read-only queries paginate when the server page limit is smaller than requested", async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-secret";
  try {
    const offsets: number[] = [];
    const rows = await readSupabaseRows(
      "players",
      "tag",
      "tag.asc",
      z.object({ tag: z.string() }),
      async (url, options) => {
        assert.equal(new URL(String(url)).searchParams.get("order"), "tag.asc");
        assert.equal(options?.cache, "no-store");
        const headers = new Headers(options?.headers);
        assert.equal(headers.get("apikey"), "test-secret");
        const offset = Number(headers.get("range")?.split("-")[0]);
        offsets.push(offset);
        const page = Array.from(
          { length: Math.min(2, 5 - offset) },
          (_, index) => ({ tag: String(offset + index) }),
        );
        return Response.json(page, {
          headers: {
            "content-range": `${offset}-${offset + page.length - 1}/5`,
          },
        });
      },
    );
    assert.deepEqual(offsets, [0, 2, 4]);
    assert.equal(rows.length, 5);
    await assert.rejects(
      readSupabaseRows(
        "players",
        "tag",
        "tag.asc",
        z.object({ tag: z.string() }),
        async () => new Response("secret upstream detail", { status: 403 }),
      ),
      /Stored rivalry data could not be loaded/,
    );
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousKey;
  }
});
