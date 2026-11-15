import { loadEnvConfig } from "@next/env";
import { build } from "esbuild";
import { randomBytes } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const slug = "collect-player-data";
const jobName = "collect-rivalry-players-hourly";
const hourlySchedule = "17 * * * *";
const artifact = path.join(
  process.cwd(),
  ".local",
  "supabase-collector",
  "index.ts",
);
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} in .env.local.`);
  return value;
}
function project() {
  const url = new URL(required("SUPABASE_URL"));
  if (
    url.protocol !== "https:" ||
    !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "SUPABASE_URL must be the hosted Supabase project root URL.",
    );
  }
  return { url: url.origin, ref: url.hostname.split(".")[0] };
}
async function database() {
  return postgres(required("DATABASE_URL"), {
    max: 1,
    prepare: false,
    connect_timeout: 15,
    ssl: {
      ca: await readFile(
        path.join(process.cwd(), "supabase/certs/prod-ca-2021.crt"),
        "utf8",
      ),
      rejectUnauthorized: true,
    },
    onnotice() {},
  });
}

async function bundle() {
  const result = await build({
    entryPoints: ["supabase/functions/collect-player-data/index.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    mainFields: ["module", "main"],
    external: ["node:*"],
    logLevel: "silent",
    define: {
      "process.env.CLASH_ROYALE_API_KEY": "__collectorEnv.apiKey",
      "process.env.SUPABASE_URL": "__collectorEnv.url",
      "process.env.SUPABASE_SECRET_KEY": "__collectorEnv.databaseKey",
    },
    banner: {
      js: 'const __collectorEnv = { apiKey: Deno.env.get("CLASH_ROYALE_API_KEY"), url: Deno.env.get("SUPABASE_URL"), databaseKey: Deno.env.get("RIVALRY_SUPABASE_SECRET_KEY") };',
    },
    // The app's server-only marker is retained everywhere else; the Edge artifact is server code.
    plugins: [
      {
        name: "edge-server-only",
        setup(builder) {
          builder.onResolve({ filter: /^server-only$/ }, () => ({
            path: "server-only",
            namespace: "edge-marker",
          }));
          builder.onLoad({ filter: /.*/, namespace: "edge-marker" }, () => ({
            contents: "export {};",
            loader: "js",
          }));
        },
      },
    ],
  });
  const source = result.outputFiles[0].text;
  if (/process\.env|next\/cache|next\/navigation/.test(source))
    throw new Error("Unsupported app runtime dependency in Edge bundle.");
  for (const name of [
    "CLASH_ROYALE_API_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_ACCESS_TOKEN",
    "COLLECTION_CRON_SECRET",
    "DATABASE_URL",
  ]) {
    if (process.env[name] && source.includes(process.env[name]!))
      throw new Error("Secret found in generated bundle.");
  }
  await mkdir(path.dirname(artifact), { recursive: true });
  await writeFile(artifact, source);
  console.log(
    `Built server-side Edge bundle (${Buffer.byteLength(source)} bytes).`,
  );
  return source;
}

async function management(endpoint: string, init: RequestInit) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${project().ref}${endpoint}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${required("SUPABASE_ACCESS_TOKEN")}`,
        ...init.headers,
      },
      redirect: "error",
      signal: AbortSignal.timeout(120_000),
    },
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `Supabase management ${endpoint.split("?")[0]} returned HTTP ${response.status}.`,
    );
  }
  return response;
}

async function verify() {
  const url = `${project().url}/functions/v1/${slug}`;
  const denied = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });
  await denied.body?.cancel();
  if (denied.status !== 401)
    throw new Error(
      `Unauthenticated function request returned HTTP ${denied.status}; expected 401.`,
    );
  const response = await fetch(url, {
    method: "POST",
    headers: { "x-collection-secret": required("COLLECTION_CRON_SECRET") },
    signal: AbortSignal.timeout(140_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `Live Edge collection returned HTTP ${response.status}. Inspect the function logs.`,
    );
  }
  const summary = await response.json();
  if (summary.ok !== true || summary.savedPlayers !== 2)
    throw new Error(
      "Live Edge collection did not confirm both player imports.",
    );
  console.log(
    `Verified authentication and live collection: both players saved, ${summary.newBattles} new matches.`,
  );
}

async function deploy() {
  required("SUPABASE_ACCESS_TOKEN");
  const source = await bundle();
  if (!process.env.COLLECTION_CRON_SECRET?.trim()) {
    const secret = randomBytes(32).toString("hex");
    await appendFile(".env.local", `\nCOLLECTION_CRON_SECRET=${secret}\n`, {
      mode: 0o600,
    });
    process.env.COLLECTION_CRON_SECRET = secret;
    console.log(
      "Generated a dedicated collector secret in ignored .env.local.",
    );
  }
  if (required("COLLECTION_CRON_SECRET").length < 32)
    throw new Error(
      "COLLECTION_CRON_SECRET must contain at least 32 characters.",
    );
  const secretsResponse = await management("/secrets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      { name: "CLASH_ROYALE_API_KEY", value: required("CLASH_ROYALE_API_KEY") },
      {
        name: "RIVALRY_SUPABASE_SECRET_KEY",
        value: required("SUPABASE_SECRET_KEY"),
      },
      {
        name: "COLLECTION_CRON_SECRET",
        value: required("COLLECTION_CRON_SECRET"),
      },
    ]),
  });
  await secretsResponse.body?.cancel();
  const form = new FormData();
  form.append(
    "metadata",
    JSON.stringify({
      name: slug,
      entrypoint_path: "index.ts",
      verify_jwt: false,
    }),
  );
  form.append(
    "file",
    new Blob([source], { type: "application/typescript" }),
    "index.ts",
  );
  const response = await management(`/functions/deploy?slug=${slug}`, {
    method: "POST",
    body: form,
  });
  const result = await response.json();
  if (result.status !== "ACTIVE" || result.verify_jwt !== false)
    throw new Error(
      "Function deployment did not confirm the expected active configuration.",
    );
  console.log(`Deployed ${slug}, version ${result.version}.`);
  await verify();
}

async function activate() {
  await verify();
  const sql = await database();
  try {
    await sql.begin(async (transaction) => {
      await transaction`select pg_advisory_xact_lock(hashtext('rivalry-collector-setup'))`;
      for (const [name, value] of [
        ["rivalry_collector_url", project().url],
        ["rivalry_collector_secret", required("COLLECTION_CRON_SECRET")],
      ]) {
        const rows = await transaction<
          { id: string }[]
        >`select id from vault.secrets where name = ${name}`;
        if (rows.length)
          await transaction`select vault.update_secret(${rows[0].id}::uuid, ${value})`;
        else await transaction`select vault.create_secret(${value}, ${name})`;
      }
      await transaction`select cron.schedule(${jobName}, ${hourlySchedule}, 'select tracker_private.dispatch_player_collection();')`;
    });
    console.log(
      `Activated Supabase Cron job ${jobName}: ${hourlySchedule} (UTC).`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function status() {
  const sql = await database();
  try {
    console.log(
      JSON.stringify({
        jobs: await sql`select jobid, jobname, schedule, active from cron.job where jobname = ${jobName}`,
      }),
    );
    console.log(
      JSON.stringify({
        dispatches:
          await sql`select d.request_id, d.requested_at, r.status_code, r.timed_out, (r.error_msg is not null) as transport_error from tracker_private.collection_dispatches d left join net._http_response r on r.id = d.request_id order by d.requested_at desc limit 5`,
      }),
    );
    console.log(
      JSON.stringify({
        cronRuns:
          await sql`select status, start_time, end_time from cron.job_run_details where jobid in (select jobid from cron.job where jobname = ${jobName}) order by start_time desc limit 5`,
      }),
    );
    console.log(
      JSON.stringify({
        players:
          await sql`select name, last_collected_at from public.players order by tag`,
      }),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  switch (process.argv[2]) {
    case "build":
      await bundle();
      break;
    case "deploy":
      await deploy();
      break;
    case "activate":
      await activate();
      break;
    case "verify":
      await verify();
      break;
    case "status":
      await status();
      break;
    default:
      throw new Error("Use build, deploy, activate, verify, or status.");
  }
}
main().catch((error) => {
  if (error && Array.isArray(error.errors)) {
    console.error(
      "Edge bundle compilation failed:",
      error.errors.map((item: { text: string }) => item.text).join("; "),
    );
    process.exitCode = 1;
    return;
  }
  // Do not expose database URLs, SQL parameter values, management responses or request headers.
  console.error(
    error instanceof Error &&
      !("code" in error) &&
      /^(Set |SUPABASE_URL |COLLECTION_CRON_SECRET |Supabase management |Unauthenticated |Live Edge |Function deployment |Unsupported app |Secret found |Use )/.test(
        error.message,
      )
      ? error.message
      : "Collector setup failed. Check configuration and project access; no credentials were logged.",
  );
  process.exitCode = 1;
});
