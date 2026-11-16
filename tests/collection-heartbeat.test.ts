import assert from "node:assert/strict";
import test from "node:test";
import { sendCollectionHeartbeat } from "../src/lib/collection-heartbeat";
import { createCollectionHandler } from "../src/lib/edge-collection-handler";

const url = "https://hc-ping.com/12345678-1234-1234-1234-123456789abc";
const secret = "test-collection-secret-at-least-32-characters";
const request = () =>
  new Request("https://collector.test", {
    method: "POST",
    headers: { "x-collection-secret": secret },
  });
const success = {
  ok: true,
  savedPlayers: 3,
  newBattles: 0,
  message: "All 3 players refreshed.",
};

test("heartbeat sends an empty POST only to its configured monitoring endpoint", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    calls++;
    assert.equal(String(input), url);
    assert.equal(init?.method, "POST");
    assert.equal(init?.body, undefined);
    assert.equal(init?.headers, undefined);
    assert.equal(init?.redirect, "error");
    return new Response("OK");
  };
  assert.equal(await sendCollectionHeartbeat(url, fetcher), "sent");
  assert.equal(calls, 1);
  assert.equal(
    await sendCollectionHeartbeat(undefined, fetcher),
    "not_configured",
  );
  for (const invalid of [
    "http://hc-ping.com/123",
    "https://untrusted.test/",
    `${url}/fail`,
    `${url}?key=private`,
    "https://user:pass@hc-ping.com/",
  ]) {
    assert.equal(await sendCollectionHeartbeat(invalid, fetcher), "failed");
  }
  assert.equal(calls, 1);
});

test("heartbeat retries transient failures and rejects provider's misleading 200 responses", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return calls === 1
      ? new Response("busy", { status: 503 })
      : new Response("OK");
  };
  assert.equal(
    await sendCollectionHeartbeat(url, fetcher, async () => {}),
    "sent",
  );
  assert.equal(calls, 2);
  calls = 0;
  const unknown: typeof fetch = async () => {
    calls++;
    return new Response("OK (not found)");
  };
  assert.equal(
    await sendCollectionHeartbeat(url, unknown, async () => {}),
    "failed",
  );
  assert.equal(calls, 3);
});

test("only a complete successful collection renews the alert timer", async () => {
  let pings = 0;
  const heartbeat = async () => {
    pings++;
    return "sent" as const;
  };
  for (const result of [
    { ...success, ok: false },
    { ...success, savedPlayers: 1 },
  ]) {
    const response = await createCollectionHandler(
      secret,
      async () => result,
      heartbeat,
    )(request());
    assert.equal((await response.json()).monitoring, "not_attempted");
  }
  assert.equal(pings, 0);
  const response = await createCollectionHandler(
    secret,
    async () => success,
    heartbeat,
  )(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).monitoring, "sent");
  assert.equal(pings, 1);
});

test("monitoring failures do not undo or misreport a successful database import", async () => {
  const response = await createCollectionHandler(
    secret,
    async () => success,
    async () => {
      throw new Error(`private ${url}`);
    },
  )(request());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.monitoring, "failed");
  assert.equal(JSON.stringify(body).includes(url), false);
});

test("unauthorized requests cannot renew the monitoring timer", async () => {
  let calls = 0;
  const response = await createCollectionHandler(
    secret,
    async () => success,
    async () => {
      calls++;
      return "sent";
    },
  )(new Request("https://collector.test", { method: "POST" }));
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});
