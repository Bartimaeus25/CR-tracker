import assert from "node:assert/strict";
import test from "node:test";
import { createCollectionHandler } from "../src/lib/edge-collection-handler";

const secret = "test-only-collector-secret-at-least-32-characters";
const success = {
  ok: true,
  savedPlayers: 2,
  newBattles: 1,
  message: "Both players refreshed. 1 new match.",
};

test("scheduled collector rejects missing and wrong secrets before collection", async () => {
  let calls = 0;
  const handler = createCollectionHandler(secret, async () => {
    calls++;
    return success;
  });
  for (const value of [undefined, "bad", "x".repeat(secret.length)]) {
    const response = await handler(
      new Request("https://collector.test", {
        method: "POST",
        headers: value ? { "x-collection-secret": value } : {},
      }),
    );
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal(calls, 0);
});

test("missing or short configured secret fails closed", async () => {
  for (const value of [undefined, "short"]) {
    const response = await createCollectionHandler(value, async () => {
      throw new Error("Must not collect");
    })(new Request("https://collector.test", { method: "POST" }));
    assert.equal(response.status, 503);
  }
});

test("authenticated requests require POST and cannot choose a player or destination", async () => {
  let calls = 0;
  const handler = createCollectionHandler(secret, async () => {
    calls++;
    return success;
  });
  const rejected = await handler(
    new Request("https://collector.test", {
      headers: { "x-collection-secret": secret },
    }),
  );
  assert.equal(rejected.status, 405);
  assert.equal(rejected.headers.get("allow"), "POST");
  assert.equal(calls, 0);
  const response = await handler(
    new Request("https://collector.test?tag=arbitrary", {
      method: "POST",
      headers: { "x-collection-secret": secret },
      body: JSON.stringify({ tag: "arbitrary", url: "https://untrusted.test" }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  const body = await response.json();
  assert.equal(body.savedPlayers, 2);
  assert.equal(body.newBattles, 1);
  assert.equal(body.ok, true);
});

test("partial collection returns a failure status with the saved-player count", async () => {
  const response = await createCollectionHandler(secret, async () => ({
    ...success,
    ok: false,
    savedPlayers: 1,
  }))(
    new Request("https://collector.test", {
      method: "POST",
      headers: { "x-collection-secret": secret },
    }),
  );
  assert.equal(response.status, 502);
  assert.equal((await response.json()).savedPlayers, 1);
});

test("unexpected collector errors never expose credentials or exception text", async () => {
  const response = await createCollectionHandler(secret, async () => {
    throw new Error(`Private credential: ${secret}`);
  })(
    new Request("https://collector.test", {
      method: "POST",
      headers: { "x-collection-secret": secret },
    }),
  );
  assert.equal(response.status, 500);
  assert.equal((await response.text()).includes(secret), false);
});
