import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createReportHandler } from "../src/lib/reports/handler";
import { getReportRecipients } from "../src/lib/reports/send";

const secret = "report-test-secret-with-at-least-32-characters";

test("recipient configuration is a validated server-side allowlist", () => {
  const previous = process.env.REPORT_RECIPIENTS;
  try {
    process.env.REPORT_RECIPIENTS =
      "first@example.com, second@example.com,first@example.com";
    assert.deepEqual(getReportRecipients(), [
      "first@example.com",
      "second@example.com",
    ]);
    process.env.REPORT_RECIPIENTS = "bad-address";
    assert.throws(() => getReportRecipients());
    delete process.env.REPORT_RECIPIENTS;
    assert.throws(() => getReportRecipients());
  } finally {
    if (previous === undefined) delete process.env.REPORT_RECIPIENTS;
    else process.env.REPORT_RECIPIENTS = previous;
  }
});
function request(body: unknown, authorized = true) {
  return new Request("https://reports.test", {
    method: "POST",
    headers: authorized ? { "x-collection-secret": secret } : {},
    body: JSON.stringify(body),
  });
}

test("report endpoint rejects unauthorized requests and arbitrary recipients", async () => {
  let calls = 0;
  const handler = createReportHandler(secret, {
    deliver: async () => {
      calls++;
      return { ok: true, message: "sent" };
    },
    verify: async () => {
      calls++;
    },
  });
  assert.equal((await handler(request({ kind: "manual" }, false))).status, 401);
  assert.equal(
    (await handler(request({ kind: "manual", to: "arbitrary@example.com" })))
      .status,
    400,
  );
  assert.equal((await handler(request({ kind: "unknown" }))).status, 400);
  assert.equal(calls, 0);
  assert.equal((await handler(request({ kind: "manual" }))).status, 200);
  assert.equal(calls, 1);
});

test("SMTP verification never sends a report and sanitized errors hide credentials", async () => {
  let sent = 0,
    verified = 0;
  const handler = createReportHandler(secret, {
    deliver: async () => {
      sent++;
      return { ok: true, message: "sent" };
    },
    verify: async () => {
      verified++;
    },
  });
  assert.equal((await handler(request({ kind: "verify-smtp" }))).status, 200);
  assert.equal(sent, 0);
  assert.equal(verified, 1);
  const failing = createReportHandler(secret, {
    deliver: async () => {
      throw new Error(`Private ${secret}`);
    },
    verify: async () => {},
  });
  const response = await failing(request({ kind: "daily" }));
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes(secret), false);
});

test("database report claims enforce daily idempotency, manual cooldown and role restrictions", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role; create schema tracker_private;",
    );
    await db.exec(
      await readFile(
        "supabase/migrations/20261115000200_email_reports.sql",
        "utf8",
      ),
    );
    await db.exec("set role service_role");
    const claim = async (kind: string, key: string) =>
      (
        await db.query<{
          value: { claimed: boolean; id?: string; reason?: string };
        }>("select public.claim_rivalry_report($1,$2) as value", [kind, key])
      ).rows[0].value;
    const daily = await claim("daily", "daily:2026-11-14");
    assert.equal(daily.claimed, true);
    assert.equal((await claim("daily", "daily:2026-11-14")).claimed, false);
    assert.equal((await claim("manual", "manual:1")).claimed, true);
    assert.equal((await claim("manual", "manual:2")).reason, "cooldown");
    await db.query("select public.finish_rivalry_report($1,2,true)", [
      daily.id,
    ]);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ status: string }>(
          "select status from tracker_private.report_deliveries where id=$1",
          [daily.id],
        )
      ).rows[0].status,
      "sent",
    );
    await db.exec("set role anon");
    await assert.rejects(claim("manual", "manual:3"), /permission denied/);
    await assert.rejects(
      db.query("select * from tracker_private.report_deliveries"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
