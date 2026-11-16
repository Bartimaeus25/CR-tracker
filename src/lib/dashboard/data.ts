import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { comparisonCookie, resolveComparison, trackedPlayers } from "@/config/players";
import { loadDashboardData } from "./load";

export const getComparison = cache(async () => {
  const value = (await cookies()).get(comparisonCookie)?.value;
  const [first, second] = value?.split(",") ?? [];
  return resolveComparison(first, second);
});

export const getDashboardData = cache(async (
  scope: "direct" | "all" = "direct",
  playerTag?: string,
) => {
  let [first, second] = await getComparison();
  const requested = trackedPlayers.find((player) => player.tag === playerTag);
  if (requested && requested.tag !== first.tag && requested.tag !== second.tag) {
    second = first;
    first = requested;
  }
  return loadDashboardData(scope, first.tag, second.tag);
});
