import assert from "node:assert/strict";
import test from "node:test";
import { trackedPlayers } from "../src/config/players";
import { capturePlayer, type PlayerApi } from "../src/lib/clash-royale/capture";
import { ClashRoyaleApiError } from "../src/lib/clash-royale/client";
import { collectionSchema, type PlayerCollection } from "../src/lib/collection";
import { refreshTrackedPlayers } from "../src/lib/manual-refresh";
import { CollectionStorageError } from "../src/lib/supabase";

function createApi(calls: string[] = []): PlayerApi {
  const participants = trackedPlayers.map((player, index) => ({
    ...player,
    crowns: index,
    cards: [],
  }));
  return {
    async getPlayer(tag) {
      calls.push(`profile:${tag}`);
      return {
        tag,
        name: trackedPlayers.find((player) => player.tag === tag)?.name ?? tag,
        trophies: 9000,
        futureField: true,
      };
    },
    async getBattlelog(tag) {
      calls.push(`battles:${tag}`);
      return [
        {
          battleTime: "20261115T120000.000Z",
          type: "friendly",
          gameMode: { id: 1 },
          team: [participants[0]],
          opponent: [participants[1]],
        },
      ];
    },
    async getUpcomingChests(tag) {
      calls.push(`chests:${tag}`);
      return { items: [{ index: 0, name: "Golden Chest" }] };
    },
  };
}

test("manual refresh fetches profiles, battlelogs, and chests for both players before reporting saved results", async () => {
  const calls: string[] = [];
  const saved: PlayerCollection[] = [];
  const result = await refreshTrackedPlayers({
    client: createApi(calls),
    save: async (input) => {
      const collection = collectionSchema.parse(input);
      saved.push(collection);
      return {
        player_tag: collection.player_tag,
        battles_received: 1,
        battles_inserted: saved.length === 1 ? 1 : 0,
      };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.savedPlayers, 2);
  assert.equal(result.newBattles, 1);
  assert.equal(calls.length, 6);
  assert.deepEqual(
    saved.map((collection) => collection.player_tag),
    trackedPlayers.map((player) => player.tag),
  );
  assert.equal(saved[0].profile.futureField, true);
  assert.equal(saved[0].upcoming_chests?.items[0].name, "Golden Chest");
  assert.match(result.message, /Both players refreshed/);
});

test("a failed player fetch still allows the other player to save and hides unexpected error details", async () => {
  const api = createApi();
  const getPlayer = api.getPlayer;
  api.getPlayer = async (tag) => {
    if (tag === trackedPlayers[0].tag)
      throw new Error("sensitive upstream token");
    return getPlayer(tag);
  };
  const saved: string[] = [];
  const result = await refreshTrackedPlayers({
    client: api,
    save: async (input) => {
      const collection = collectionSchema.parse(input);
      saved.push(collection.player_tag);
      return {
        player_tag: collection.player_tag,
        battles_received: 1,
        battles_inserted: 0,
      };
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.savedPlayers, 1);
  assert.deepEqual(saved, [trackedPlayers[1].tag]);
  assert.match(result.message, /1\/2 players refreshed/);
  assert.ok(!result.message.includes("sensitive upstream token"));
});

test("optional chest errors retain the fresh profile and battlelog and report a partial result", async () => {
  const api = createApi();
  api.getUpcomingChests = async () => {
    throw new ClashRoyaleApiError("Upcoming chests unavailable.", 503);
  };
  const capture = await capturePlayer(api, trackedPlayers[0].tag);
  assert.equal(capture.battles.length, 1);
  assert.equal(capture.upcoming_chests, null);
  assert.equal(capture.upcoming_chests_error, "Upcoming chests unavailable.");
  const result = await refreshTrackedPlayers({
    client: api,
    save: async (input) => {
      const collection = collectionSchema.parse(input);
      assert.equal(collection.upcoming_chests, null);
      return {
        player_tag: collection.player_tag,
        battles_received: 1,
        battles_inserted: 0,
      };
    },
  });
  assert.equal(result.savedPlayers, 2);
  assert.equal(result.ok, false);
  assert.match(result.message, /Upcoming chests unavailable/);
});

test("database failures are reported without marking the affected player as saved", async () => {
  const result = await refreshTrackedPlayers({
    client: createApi(),
    save: async () => {
      throw new CollectionStorageError(
        "Supabase returned HTTP 503. Please try again.",
      );
    },
  });
  assert.equal(result.savedPlayers, 0);
  assert.equal(result.newBattles, 0);
  assert.equal(result.ok, false);
  assert.match(result.message, /HTTP 503/);
});

test("concurrent manual refreshes share one collection and a later click can fetch again", async () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls: string[] = [];
  const api = createApi(calls);
  const getPlayer = api.getPlayer;
  api.getPlayer = async (tag) => {
    await gate;
    return getPlayer(tag);
  };
  let writes = 0;
  const dependencies = {
    client: api,
    save: async (input: unknown) => {
      const collection = collectionSchema.parse(input);
      writes++;
      return {
        player_tag: collection.player_tag,
        battles_received: 1,
        battles_inserted: 0,
      };
    },
  };
  const first = refreshTrackedPlayers(dependencies);
  const second = refreshTrackedPlayers(dependencies);
  assert.equal(first, second);
  release();
  await Promise.all([first, second]);
  assert.equal(calls.length, 6);
  assert.equal(writes, 2);
  await refreshTrackedPlayers(dependencies);
  assert.equal(calls.length, 12);
  assert.equal(writes, 4);
});
