import { loadEnvConfig } from "@next/env";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { sendCollectionHeartbeat } from "../src/lib/collection-heartbeat";

loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const slug = "clash-rivalry-hourly-collection";
const recipient = "jan.portius@web.de";
const checkSchema = z.object({
  uuid: z.string().uuid(),
  ping_url: z.string().url(),
  status: z.string(),
  timeout: z.number().optional(),
  grace: z.number(),
  schedule: z.string().optional(),
  channels: z.string(),
  last_ping: z.string().nullable(),
  n_pings: z.number(),
});

async function api(endpoint: string, payload?: unknown) {
  const key = process.env.HEALTHCHECKS_API_KEY?.trim();
  if (!key)
    throw new Error(
      "Set HEALTHCHECKS_API_KEY in .env.local using the project's read-write key.",
    );
  const response = await fetch(`https://healthchecks.io/api/v3/${endpoint}`, {
    method: payload ? "POST" : "GET",
    headers: { "X-Api-Key": key, "Content-Type": "application/json" },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `Healthchecks configuration API returned HTTP ${response.status}.`,
    );
  }
  return response.json();
}
async function existingCheck() {
  const result = z
    .object({ checks: z.array(checkSchema) })
    .parse(await api(`checks/?slug=${slug}`));
  if (result.checks.length !== 1)
    throw new Error(
      "Expected exactly one collection check. Run alerts:setup first.",
    );
  return result.checks[0];
}
function report(check: z.infer<typeof checkSchema>) {
  console.log(
    JSON.stringify({
      recipient,
      status: check.status,
      periodSeconds: check.timeout,
      graceSeconds: check.grace,
      emailChannelAssigned: Boolean(check.channels),
      emailChannelCount: check.channels.split(",").filter(Boolean).length,
      lastHeartbeat: check.last_ping,
      heartbeats: check.n_pings,
    }),
  );
}

async function setup() {
  const result = z
    .object({
      channels: z.array(
        z.object({ id: z.string().uuid(), kind: z.string(), name: z.string() }),
      ),
    })
    .parse(await api("channels/"));
  const emails = result.channels.filter((channel) => channel.kind === "email");
  // The setup instructions require an account verified with the requested address.
  // Healthchecks' API exposes channel names, but not their underlying email address.
  const channel =
    emails.find((value) => value.name.toLowerCase().includes(recipient)) ??
    (emails.length === 1 ? emails[0] : undefined);
  const includeSecond = process.argv.includes("--include-second-email");
  const assignedChannels =
    includeSecond && emails.length === 2
      ? emails.map((value) => value.id)
      : channel
        ? [channel.id]
        : [];
  if (!assignedChannels.length || (includeSecond && emails.length !== 2))
    throw new Error(
      `Configure one verified email integration for ${recipient}, or name that integration with this address.`,
    );
  const check = checkSchema.parse(
    await api("checks/", {
      name: "Clash Royale scheduled collection",
      slug,
      tags: "clash-rivalry production",
      unique: ["slug"],
      timeout: 3600,
      grace: 3600,
      methods: "POST",
      channels: assignedChannels.join(","),
      desc: "Hourly Supabase collection at :17. Alert after two hours without a complete successful collection of both players. A setup-only heartbeat arms the initial timer; subsequent heartbeats come from the scheduled Edge collector. Check Supabase Cron, Edge Function logs, and npm run collector:status. The dashboard's local refresh does not reset this monitor.",
    }),
  );
  if (
    check.timeout !== 3600 ||
    check.grace !== 3600 ||
    check.schedule ||
    check.channels.split(",").sort().join(",") !==
      assignedChannels.sort().join(",")
  )
    throw new Error(
      "Healthchecks did not confirm the expected two-hour email policy.",
    );
  const url = new URL(check.ping_url);
  if (
    url.origin !== "https://hc-ping.com" ||
    url.pathname !== `/${check.uuid}` ||
    url.search ||
    url.hash
  )
    throw new Error("Healthchecks returned an unsupported heartbeat URL.");
  const env = await readFile(".env.local", "utf8");
  const line = `HEALTHCHECKS_PING_URL=${check.ping_url}`;
  await writeFile(
    ".env.local",
    /^HEALTHCHECKS_PING_URL=.*$/m.test(env)
      ? env.replace(/^HEALTHCHECKS_PING_URL=.*$/m, () => line)
      : `${env}\n${line}\n`,
    { mode: 0o600 },
  );
  report(check);
  console.log(
    "Saved private heartbeat URL to ignored .env.local. No collection, heartbeat, or test email was triggered.",
  );
}

async function main() {
  if (process.argv[2] === "setup") {
    await setup();
    return;
  }
  const check = await existingCheck();
  if (process.argv[2] === "arm") {
    if (check.status === "new" && check.last_ping === null) {
      if ((await sendCollectionHeartbeat(check.ping_url)) !== "sent")
        throw new Error("Could not arm the external monitor.");
      console.log(
        "Armed initial two-hour monitoring timer only. No collection or test email was triggered.",
      );
      report(checkSchema.parse(await api(`checks/${check.uuid}`)));
    } else {
      console.log("Monitor already initialized; its timer was not reset.");
      report(check);
    }
  } else if (process.argv[2] === "status") report(check);
  else throw new Error("Use setup, arm, or status.");
}
main().catch((error) => {
  // API responses and private ping URLs never go to logs.
  console.error(
    error instanceof Error &&
      /^(Set HEALTHCHECKS|Healthchecks |Expected exactly|Configure one|Could not arm|Use setup)/.test(
        error.message,
      )
      ? error.message
      : "Alert setup failed. Check the monitoring account and API configuration; no credentials were logged.",
  );
  process.exitCode = 1;
});
