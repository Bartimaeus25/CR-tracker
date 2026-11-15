import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { contentHash, prepareCollection } from "../src/lib/collection";
import { CollectionStorageError, saveCollection } from "../src/lib/supabase";

const firstTag = "#2CVGR2R8R";
const secondTag = "#9Q2PQLG0L";
const first = { tag: firstTag, name: "Sprengmeister", crowns: 2, cards: [{ id: 26000000, name: "Knight", level: 14 }], elixirLeaked: 1.2 };
const second = { tag: secondTag, name: "Bartimaues", crowns: 1, cards: [{ id: 26000001, name: "Archers", evolutionLevel: 1 }] };
const battle = {
  type: "PvP", battleTime: "20261114T120000.000Z", gameMode: { id: 72000006, name: "Ladder" },
  team: [first], opponent: [second], arena: { id: 54000001 }, futureField: { retained: true },
};

function collection(tag = firstTag) {
  return {
    player_tag: tag, observed_at: "2026-11-14T12:01:00.000Z",
    profile: { tag, name: tag === firstTag ? first.name : second.name, trophies: 9000, achievements: [{ name: "Test", stars: 3 }] },
    battles: [battle], upcoming_chests: { items: [{ index: 0, name: "Silver Chest" }], futureField: true },
    upcoming_chests_error: null,
  };
}

test("battle identity survives opposing perspectives, roster order, and response property order", () => {
  const original = prepareCollection(collection());
  const reversed = prepareCollection({ ...collection(secondTag), battles: [{ ...battle, team: battle.opponent, opponent: battle.team }] });
  assert.equal(original.battles[0].id, reversed.battles[0].id);
  assert.notEqual(original.battles[0].payload_hash, reversed.battles[0].payload_hash);
  assert.deepEqual(original.battles[0].participants, reversed.battles[0].participants);
  assert.equal(original.battles[0].participants.find((participant) => participant.tag === firstTag)?.result, "win");
  assert.equal(contentHash({ a: 1, b: [2, 3] }), contentHash({ b: [2, 3], a: 1 }));
  assert.notEqual(contentHash([1, 2]), contentHash([2, 1]));

  const ally = { ...first, tag: "#P0Y" };
  const partner = { ...second, tag: "#P0Q" };
  const doubles = { ...battle, team: [first, ally], opponent: [second, partner] };
  const reordered = { ...doubles, team: [ally, first], opponent: [partner, second] };
  assert.equal(prepareCollection({ ...collection(), battles: [doubles] }).battles[0].id,
    prepareCollection({ ...collection(), battles: [reordered] }).battles[0].id);
});

test("keeps unknown raw fields and rejects mismatched players and impossible dates", () => {
  const prepared = prepareCollection(collection());
  assert.deepEqual(prepared.battles[0].raw, battle);
  assert.deepEqual(prepared.profile.achievements, [{ name: "Test", stars: 3 }]);
  assert.throws(() => prepareCollection({ ...collection(), player_tag: secondTag }), /does not match/);
  assert.throws(() => prepareCollection({ ...collection("#P0Y") }), /does not include/);
  assert.throws(() => prepareCollection({ ...collection(), battles: [{ ...battle, battleTime: "20260230T120000.000Z" }] }), /calendar timestamp/);
});

test("database migration supports atomic, idempotent imports and blocks browser roles", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(await readFile("supabase/migrations/20261114000100_player_collection.sql", "utf8"));
    await db.exec("set role service_role");
    const ingest = async (payload: ReturnType<typeof prepareCollection>) => {
      const result = await db.query<{ summary: { battles_inserted: number } }>(
        "select public.ingest_player_collection($1::jsonb) as summary", [JSON.stringify(payload)],
      );
      return result.rows[0].summary;
    };
    const count = async (table: string) => (await db.query<{ count: number }>(`select count(*)::int as count from public.${table}`)).rows[0].count;
    const prepared = prepareCollection(collection());
    assert.equal((await ingest(prepared)).battles_inserted, 1);
    assert.equal((await ingest(prepared)).battles_inserted, 0);
    assert.equal(await count("player_observations"), 1);
    assert.equal(await count("battle_observations"), 1);

    const reversed = prepareCollection({ ...collection(secondTag), battles: [{ ...battle, team: battle.opponent, opponent: battle.team }] });
    assert.equal((await ingest(reversed)).battles_inserted, 0);
    assert.equal(await count("players"), 2);
    assert.equal(await count("battles"), 1);
    assert.equal(await count("battle_participants"), 2);
    assert.equal(await count("battle_observations"), 2);

    await ingest({ ...prepared, observed_at: "2026-11-14T12:02:00.000Z" });
    assert.equal(await count("player_snapshots"), 2);
    assert.equal(await count("player_observations"), 3);

    const newer = prepareCollection({ ...collection(), observed_at: "2026-11-14T12:03:00.000Z", profile: { ...collection().profile, trophies: 9100 } });
    await ingest(newer);
    await ingest({ ...prepared, observed_at: "2026-11-14T11:00:00.000Z" });
    const latest = await db.query<{ trophies: string }>("select latest_profile->>'trophies' as trophies from public.players where tag = $1", [firstTag]);
    assert.equal(latest.rows[0].trophies, "9100");

    const changedRaw = prepareCollection({ ...collection(), observed_at: "2026-11-14T12:04:00.000Z", battles: [{ ...battle, futureField: { retained: false } }] });
    await ingest(changedRaw);
    assert.equal(await count("battle_observations"), 3);

    const beforeFailure = await count("player_observations");
    const invalid = { ...prepared, observed_at: "2026-11-14T12:05:00.000Z", battles: [...prepared.battles, { ...prepared.battles[0], id: "invalid" }] };
    await assert.rejects(ingest(invalid));
    assert.equal(await count("player_observations"), beforeFailure);
    assert.equal(await count("battles"), 1);

    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select * from public.players"), /permission denied/);
    await assert.rejects(db.query("select public.ingest_player_collection($1::jsonb)", [JSON.stringify(prepared)]), /permission denied/);
    await db.exec("reset role; set role authenticated");
    await assert.rejects(db.query("select * from public.battles"), /permission denied/);
    await assert.rejects(db.query("select public.ingest_player_collection($1::jsonb)", [JSON.stringify(prepared)]), /permission denied/);
  } finally {
    await db.close();
  }
});

test("Supabase RPC sends the secret in apikey and gives safe migration errors", async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-secret";
  try {
    await assert.rejects(saveCollection(collection(), async (url, options) => {
      assert.equal(String(url), "https://example.supabase.co/rest/v1/rpc/ingest_player_collection");
      const headers = new Headers(options?.headers);
      assert.equal(headers.get("apikey"), "test-secret");
      assert.equal(headers.get("authorization"), null);
      assert.equal(options?.redirect, "error");
      return new Response("sensitive upstream detail", { status: 404 });
    }), (error: unknown) => {
      assert.ok(error instanceof CollectionStorageError);
      assert.match(error.message, /db:migrate/);
      assert.ok(!error.message.includes("sensitive"));
      return true;
    });
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousKey;
  }
});
