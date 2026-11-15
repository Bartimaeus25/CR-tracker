import "server-only";
import {
  ClashRoyaleApiError,
  type ClashRoyaleClient,
  type UpcomingChests,
} from "./client";
import { collectionSchema } from "../collection";

export type PlayerApi = Pick<
  ClashRoyaleClient,
  "getPlayer" | "getBattlelog" | "getUpcomingChests"
>;

export async function capturePlayer(client: PlayerApi, tag: string) {
  const profile = await client.getPlayer(tag);
  const battles = await client.getBattlelog(tag);
  let upcomingChests: UpcomingChests | null = null;
  let chestsError: string | null = null;
  try {
    upcomingChests = await client.getUpcomingChests(tag);
  } catch (error) {
    chestsError =
      error instanceof ClashRoyaleApiError
        ? error.message
        : "Upcoming chest request failed.";
  }
  return collectionSchema.parse({
    player_tag: tag,
    observed_at: new Date().toISOString(),
    profile,
    battles,
    upcoming_chests: upcomingChests,
    upcoming_chests_error: chestsError,
  });
}
