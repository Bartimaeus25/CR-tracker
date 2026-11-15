import { loadEnvConfig } from "@next/env";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

async function main() {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("Set DATABASE_URL to the Supabase PostgreSQL session-pooler connection string in .env.local.");
    process.exitCode = 1;
    return;
  }
  const ca = await readFile(path.join(process.cwd(), "supabase", "certs", "prod-ca-2021.crt"), "utf8");
  const sql = postgres(databaseUrl, {
    max: 1, ssl: { ca, rejectUnauthorized: true }, connect_timeout: 15, prepare: false,
    onnotice() {},
  });
  try {
    const directory = path.join(process.cwd(), "supabase", "migrations");
    const filenames = (await readdir(directory)).filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
    await sql.begin(async (transaction) => {
      await transaction`select pg_advisory_xact_lock(hashtext('clash-rivalry-migrations'))`;
      await transaction`create schema if not exists tracker_private`;
      await transaction`revoke all on schema tracker_private from public`;
      await transaction`create table if not exists tracker_private.schema_migrations (
        filename text primary key, checksum text not null, applied_at timestamptz not null default now()
      )`;
      for (const filename of filenames) {
        const source = await readFile(path.join(directory, filename), "utf8");
        const checksum = createHash("sha256").update(source).digest("hex");
        const applied = await transaction<{ checksum: string }[]>`
          select checksum from tracker_private.schema_migrations where filename = ${filename}
        `;
        if (applied.length > 0) {
          if (applied[0].checksum !== checksum) throw new Error("MIGRATION_CHANGED");
          console.log(`Already applied ${filename}`);
          continue;
        }
        await transaction.unsafe(source);
        await transaction`insert into tracker_private.schema_migrations (filename, checksum) values (${filename}, ${checksum})`;
        console.log(`Applied ${filename}`);
      }
    });
    console.log("Database migrations committed.");
  } catch (error) {
    if (error instanceof Error && error.message === "MIGRATION_CHANGED") {
      console.error("An applied migration has changed. Restore it and add a new migration for further changes.");
    } else {
      const code = error instanceof Error && "code" in error && typeof error.code === "string"
        && /^[A-Z0-9_]{2,64}$/.test(error.code) ? error.code : "UNKNOWN";
      const hints: Record<string, string> = {
        "28P01": "Supabase rejected the database password. Correct the password in DATABASE_URL.",
        ENOTFOUND: "Check the database hostname. Use the session pooler on a computer without IPv6.",
        ENETUNREACH: "The database network is unreachable. Check the session-pooler connection string.",
        SELF_SIGNED_CERT_IN_CHAIN: "Check the Supabase CA certificate in supabase/certs.",
      };
      console.error(`Database migration failed (${code}) and was rolled back. ${hints[code] ?? "Check DATABASE_URL and database access."}`);
    }
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(() => {
  console.error("Could not start database migration. Check local configuration.");
  process.exitCode = 1;
});
