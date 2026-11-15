import "server-only";
import { trackedPlayers } from "@/config/players";
import { capturePlayer, type PlayerApi } from "@/lib/clash-royale/capture";
import {
  ClashRoyaleApiError,
  ClashRoyaleClient,
} from "@/lib/clash-royale/client";
import { CollectionStorageError, saveCollection } from "@/lib/supabase";

interface RefreshDependencies {
  client?: PlayerApi;
  save?: typeof saveCollection;
}

export interface RefreshResult {
  ok: boolean;
  savedPlayers: number;
  newBattles: number;
  message: string;
}

let inFlight: Promise<RefreshResult> | null = null;

async function collectAndSave(
  dependencies: RefreshDependencies,
): Promise<RefreshResult> {
  const client = dependencies.client ?? new ClashRoyaleClient();
  const save = dependencies.save ?? saveCollection;
  const issues: string[] = [];
  let savedPlayers = 0;
  let newBattles = 0;

  for (const player of trackedPlayers) {
    try {
      const collection = await capturePlayer(client, player.tag);
      const summary = await save(collection);
      savedPlayers++;
      newBattles += summary.battles_inserted;
      if (collection.upcoming_chests_error) {
        issues.push(`${player.name}: ${collection.upcoming_chests_error}`);
      }
    } catch (error) {
      const message =
        error instanceof ClashRoyaleApiError ||
        error instanceof CollectionStorageError
          ? error.message
          : "Player data could not be refreshed. Please try again.";
      issues.push(`${player.name}: ${message}`);
    }
  }

  const prefix =
    savedPlayers === trackedPlayers.length
      ? "Both players refreshed"
      : `${savedPlayers}/${trackedPlayers.length} players refreshed`;
  return {
    ok: issues.length === 0,
    savedPlayers,
    newBattles,
    message: `${prefix}. ${newBattles} new ${newBattles === 1 ? "match" : "matches"}.${issues.length ? ` ${issues.join(" ")}` : ""}`,
  };
}

/** Coalesce simultaneous requests from multiple tabs in this server process. */
export function refreshTrackedPlayers(
  dependencies: RefreshDependencies = {},
): Promise<RefreshResult> {
  if (!inFlight) {
    inFlight = collectAndSave(dependencies).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
