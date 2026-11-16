"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { comparisonCookie, resolveComparison } from "@/config/players";
import {
  refreshTrackedPlayers,
  type RefreshResult,
} from "@/lib/manual-refresh";

export async function changeComparison(formData: FormData): Promise<void> {
  const pair = resolveComparison(
    String(formData.get("first") ?? ""),
    String(formData.get("second") ?? ""),
  );
  (await cookies()).set(comparisonCookie, pair.map((player) => player.tag).join(","), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  refresh();
}

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
