import "server-only";
import { timingSafeEqual } from "node:crypto";
import { refreshTrackedPlayers, type RefreshResult } from "./manual-refresh";
import { CollectionStorageError, saveCollection } from "./supabase";
import {
  sendCollectionHeartbeat,
  type HeartbeatStatus,
} from "./collection-heartbeat";
import { trackedPlayers } from "@/config/players";

async function saveWithRetries(input: unknown) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await saveCollection(input);
    } catch (error) {
      if (!(error instanceof CollectionStorageError) || attempt >= 2)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}

/** No player tags, URLs or credentials are accepted from the request body. */
export function createCollectionHandler(
  secret: string | undefined,
  collect: () => Promise<RefreshResult> = () =>
    refreshTrackedPlayers({ save: saveWithRetries }),
  heartbeat: () => Promise<HeartbeatStatus> = () =>
    sendCollectionHeartbeat(process.env.HEALTHCHECKS_PING_URL),
) {
  const expected = new TextEncoder().encode(secret ?? "");
  return async (request: Request): Promise<Response> => {
    const headers = { "Cache-Control": "no-store" };
    if (expected.length < 32)
      return Response.json(
        { error: "Collector configuration unavailable." },
        { status: 503, headers },
      );
    const provided = new TextEncoder().encode(
      request.headers.get("x-collection-secret") ?? "",
    );
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      return Response.json(
        { error: "Unauthorized." },
        { status: 401, headers },
      );
    }
    if (request.method !== "POST")
      return Response.json(
        { error: "Method not allowed." },
        { status: 405, headers: { ...headers, Allow: "POST" } },
      );
    const startedAt = new Date().toISOString();
    try {
      const result = await collect();
      let monitoring: HeartbeatStatus = "not_attempted";
      if (result.ok && result.savedPlayers === trackedPlayers.length) {
        try {
          monitoring = await heartbeat();
        } catch {
          monitoring = "failed";
        }
      }
      // All messages originate in the sanitized shared collector; never log requests or environment.
      console.info(
        JSON.stringify({
          event: "player_collection",
          startedAt,
          finishedAt: new Date().toISOString(),
          ...result,
          monitoring,
        }),
      );
      return Response.json(
        { startedAt, ...result, monitoring },
        { status: result.ok ? 200 : 502, headers },
      );
    } catch {
      console.error(
        JSON.stringify({
          event: "player_collection",
          startedAt,
          ok: false,
          message: "Collector failed unexpectedly.",
        }),
      );
      return Response.json(
        { error: "Collection failed. Retry is safe." },
        { status: 500, headers },
      );
    }
  };
}
