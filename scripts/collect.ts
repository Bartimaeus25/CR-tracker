import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { trackedPlayers } from "../src/config/players";
import { ClashRoyaleApiError, ClashRoyaleClient } from "../src/lib/clash-royale/client";
import { capturePlayer } from "../src/lib/clash-royale/capture";
import { CollectionStorageError, saveCollection } from "../src/lib/supabase";

async function main() {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const client = new ClashRoyaleClient();
  const pendingDirectory = path.join(process.cwd(), ".local", "pending");
  await mkdir(pendingDirectory, { recursive: true });
  let failures = 0;

  for (const player of trackedPlayers) {
    try {
      const collection = await capturePlayer(client, player.tag);
      if (collection.upcoming_chests_error) {
        console.warn(`PARTIAL ${player.name}: ${collection.upcoming_chests_error}`);
        failures++;
      }
      const filename = `${collection.observed_at.replace(/[:.]/g, "-")}-${randomUUID()}.json`;
      await writeFile(path.join(pendingDirectory, filename), JSON.stringify(collection), { flag: "wx", mode: 0o600 });
      console.log(`CAPTURED ${player.name}: profile, ${collection.battles.length} battles, ${collection.upcoming_chests?.items.length ?? 0} upcoming chests.`);
    } catch (error) {
      console.error(`FAILED ${player.name}: ${error instanceof ClashRoyaleApiError ? error.message : "Could not capture player data."}`);
      failures++;
    }
  }

  const pendingFiles = (await readdir(pendingDirectory)).filter((filename) => filename.endsWith(".json")).sort();
  let saved = 0;
  for (const filename of pendingFiles) {
    const collectionPath = path.join(pendingDirectory, filename);
    try {
      const collection = JSON.parse(await readFile(collectionPath, "utf8")) as unknown;
      const summary = await saveCollection(collection);
      await rm(collectionPath, { force: true });
      saved++;
      console.log(`SAVED ${summary.player_tag}: ${summary.battles_received} battles observed, ${summary.battles_inserted} new.`);
    } catch (error) {
      // Another collector can already have imported and removed the same file.
      if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
      console.error(error instanceof CollectionStorageError ? error.message : "Could not import a pending collection. Its file was retained.");
      failures++;
    }
  }

  const remaining = (await readdir(pendingDirectory)).filter((filename) => filename.endsWith(".json")).length;
  console.log(`Collection finished: ${saved} imports saved, ${remaining} pending, ${failures} errors.`);
  if (failures > 0) process.exitCode = 1;
}

main().catch(() => {
  console.error("Collection could not finish. Check local configuration and pending files in .local/pending.");
  process.exitCode = 1;
});
