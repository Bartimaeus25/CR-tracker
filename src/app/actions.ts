"use server";

import { refresh } from "next/cache";
import {
  refreshTrackedPlayers,
  type RefreshResult,
} from "@/lib/manual-refresh";

export async function refreshPlayerData(): Promise<RefreshResult> {
  let result: RefreshResult;
  try {
    result = await refreshTrackedPlayers();
  } catch {
    return {
      ok: false,
      savedPlayers: 0,
      newBattles: 0,
      message:
        "Refresh could not start. Check the server configuration and try again.",
    };
  }
  if (result.savedPlayers > 0) refresh();
  return result;
}
