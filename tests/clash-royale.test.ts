import assert from "node:assert/strict";
import test from "node:test";
import { ClashRoyaleApiError, ClashRoyaleClient, normalizePlayerTag } from "../src/lib/clash-royale/client";

const profile = { tag: "#2CVGR2R8R", name: "Sprengmeister", trophies: 9000 };
const noSleep = async () => {};

test("normalizes tags and rejects invalid input before a request", () => {
  assert.equal(normalizePlayerTag(" 2cvgr2r8r "), profile.tag);
  assert.throws(() => normalizePlayerTag("#invalid/path"), ClashRoyaleApiError);
  assert.throws(() => new ClashRoyaleClient(" "), /Set CLASH_ROYALE_API_KEY/);
});

test("encodes the tag and keeps credentials in server request headers", async () => {
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(url, "https://proxy.royaleapi.dev/v1/players/%232CVGR2R8R");
    assert.equal(new Headers(options?.headers).get("authorization"), "Bearer test-key");
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.redirect, "error");
    return Response.json({ ...profile, futureField: true });
  };
  const result = await new ClashRoyaleClient("test-key", fetcher).getPlayer(profile.tag);
  assert.equal(result.tag, profile.tag);
  assert.equal(result.futureField, true);
});

test("accepts empty battlelogs and preserves raw battle fields", async () => {
  const participant = { tag: profile.tag, name: profile.name, crowns: 1, cards: [{ id: 26000000, name: "Knight", level: 14 }] };
  const battle = {
    type: "PvP", battleTime: "20261114T120000.000Z", gameMode: { id: 72000006 },
    team: [participant], opponent: [participant], arena: { id: 54000001 },
  };
  let payload: unknown = [];
  const client = new ClashRoyaleClient("test-key", async (url) => {
    assert.ok(String(url).endsWith("/battlelog"));
    return Response.json(payload);
  });
  assert.deepEqual(await client.getBattlelog(profile.tag), []);
  payload = [battle];
  assert.deepEqual(await client.getBattlelog(profile.tag), [battle]);
  payload = [{ ...battle, team: [] }];
  await assert.rejects(client.getBattlelog(profile.tag), /invalid response/);
});

test("retries transient errors and honors Retry-After", async () => {
  let calls = 0;
  const delays: number[] = [];
  const client = new ClashRoyaleClient("test-key", async () => {
    calls++;
    if (calls === 1) return new Response(null, { status: 429, headers: { "Retry-After": "2" } });
    if (calls === 2) return new Response(null, { status: 503 });
    return Response.json(profile);
  }, async (delay) => { delays.push(delay); });
  await client.getPlayer(profile.tag);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [2000, 1000]);
});

test("fetches and validates upcoming chests while retaining additional fields", async () => {
  const payload = { items: [{ index: 0, name: "Silver Chest", futureField: 1 }], futureField: true };
  const client = new ClashRoyaleClient("test-key", async (url) => {
    assert.equal(url, "https://proxy.royaleapi.dev/v1/players/%232CVGR2R8R/upcomingchests");
    return Response.json(payload);
  });
  assert.deepEqual(await client.getUpcomingChests(profile.tag), payload);
});

test("stops after bounded network retries and hides upstream error text", async () => {
  let calls = 0;
  const client = new ClashRoyaleClient("test-key", async () => {
    calls++;
    throw new Error("sensitive upstream text");
  }, noSleep);
  await assert.rejects(client.getPlayer(profile.tag), (error: unknown) => {
    assert.ok(error instanceof ClashRoyaleApiError);
    assert.ok(!error.message.includes("sensitive"));
    return true;
  });
  assert.equal(calls, 3);
});

test("authentication failures are actionable, sanitized, and never retried", async () => {
  let calls = 0;
  const client = new ClashRoyaleClient("test-key", async () => {
    calls++;
    return new Response("secret upstream body", { status: 403 });
  }, noSleep);
  await assert.rejects(client.getPlayer(profile.tag), (error: unknown) => {
    assert.ok(error instanceof ClashRoyaleApiError);
    assert.equal(error.status, 403);
    assert.match(error.message, /45\.79\.218\.79/);
    assert.ok(!error.message.includes("secret upstream body"));
    return true;
  });
  assert.equal(calls, 1);
});

test("does not retry earlier than a long Retry-After", async () => {
  const client = new ClashRoyaleClient("test-key", async () => new Response(null, {
    status: 429, headers: { "Retry-After": "120" },
  }), async () => assert.fail("Should return the rate limit error immediately"));
  await assert.rejects(client.getPlayer(profile.tag), /HTTP 429/);
});

test("rejects malformed JSON, invalid profiles, and mismatched player tags", async () => {
  for (const response of [
    new Response("not json", { status: 200 }),
    Response.json({ tag: profile.tag }),
    Response.json({ ...profile, tag: "#9Q2PQLG0L" }),
  ]) {
    const client = new ClashRoyaleClient("test-key", async () => response);
    await assert.rejects(client.getPlayer(profile.tag), ClashRoyaleApiError);
  }
});
