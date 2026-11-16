import assert from "node:assert/strict";
import test from "node:test";
import { defaultComparison, resolveComparison, trackedPlayers } from "../src/config/players";
import { loadDashboardData } from "../src/lib/dashboard/load";

test("comparison defaults to Sprengmeister and Bartimaues and rejects invalid or duplicate tags", () => {
  assert.deepEqual(defaultComparison.map((player) => player.tag), ["#2CVGR2R8R", "#9Q2PQLG0L"]);
  for (const pair of [[undefined, undefined], ["#UNKNOWN", "#8V22J2U02"], ["#2CVGR2R8R", "#2CVGR2R8R"]]) {
    assert.deepEqual(resolveComparison(...pair), defaultComparison);
  }
  for (const first of trackedPlayers) {
    for (const second of trackedPlayers) {
      if (first.tag !== second.tag) {
        assert.deepEqual(resolveComparison(first.tag, second.tag), [first, second]);
      }
    }
  }
});

test("dashboard filters direct matches, all-opponent matches and profiles to the selected pair", async () => {
  const originalFetch = globalThis.fetch;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://comparison.test";
  process.env.SUPABASE_SECRET_KEY = "test-key";
  const battles = [[0, 1], [0, 2], [1, 2], [1, 3]].map(([first, second], index) => ({
    id: String(index),
    battle_time: "2026-11-16T12:00:00Z",
    battle_type: "friendly",
    game_mode: { name: "Friendly" },
    battle_participants: [first, second].map((player, side) => ({
      player_tag: trackedPlayers[player]?.tag ?? "#OPPONENT",
      name: trackedPlayers[player]?.name ?? "Opponent",
      side, crowns: side, cards: [], raw_participant: {},
    })),
  }));
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    return Response.json(url.pathname.endsWith("/battles") ? battles : []);
  };
  try {
    const defaults = await loadDashboardData();
    assert.deepEqual(defaults.players.map((player) => player.tag), defaultComparison.map((player) => player.tag));
    assert.deepEqual(defaults.matches.map((match) => match.id), ["0"]);
    const direct = await loadDashboardData("direct", trackedPlayers[0].tag, trackedPlayers[1].tag);
    assert.deepEqual(direct.matches.map((match) => match.id), ["0"]);
    const all = await loadDashboardData("all", trackedPlayers[0].tag, trackedPlayers[2].tag);
    assert.deepEqual(all.matches.map((match) => match.id).sort(), ["0", "1", "2"]);
    assert.equal(all.players.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});
