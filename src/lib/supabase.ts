import "server-only";
import { z } from "zod";
import { prepareCollection } from "./collection";

const summarySchema = z.object({
  player_tag: z.string(),
  battles_received: z.number().int().nonnegative(),
  battles_inserted: z.number().int().nonnegative(),
});

export class CollectionStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollectionStorageError";
  }
}

/** Server-only, read-only access. Stable ordering and ranges avoid the API's row limit. */
export async function readSupabaseRows<T>(
  table: "players" | "battles" | "player_observations",
  select: string,
  order: string,
  schema: z.ZodType<T>,
  fetcher: typeof fetch = fetch,
): Promise<T[]> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new Error("Dashboard database configuration is unavailable.");
  const endpoint = new URL(`/rest/v1/${table}`, url);
  if (endpoint.protocol !== "https:") throw new Error("Dashboard database URL must use HTTPS.");
  endpoint.searchParams.set("select", select);
  endpoint.searchParams.set("order", order);
  const rows: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; ;) {
    try {
      const response = await fetcher(endpoint, {
        headers: { apikey: key, Accept: "application/json", Prefer: "count=exact", "Range-Unit": "items", Range: `${offset}-${offset + pageSize - 1}` },
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) { await response.body?.cancel(); throw new Error(); }
      const page = z.array(schema).parse(await response.json());
      rows.push(...page);
      const totalMatch = response.headers.get("content-range")?.match(/\/(\d+)$/);
      const total = totalMatch ? Number(totalMatch[1]) : null;
      if (!page.length || (total !== null ? rows.length >= total : page.length < pageSize)) return rows;
      offset += page.length;
    } catch {
      throw new Error("Stored rivalry data could not be loaded. Please try again.");
    }
  }
}

export async function saveCollection(input: unknown, fetcher: typeof fetch = fetch) {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new CollectionStorageError("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.");

  let endpoint: URL;
  try {
    endpoint = new URL("/rest/v1/rpc/ingest_player_collection", url);
    if (endpoint.protocol !== "https:") throw new Error();
  } catch {
    throw new CollectionStorageError("SUPABASE_URL must be an HTTPS project URL.");
  }

  const collection = prepareCollection(input);
  let response: Response;
  try {
    response = await fetcher(endpoint, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ p_collection: collection }),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new CollectionStorageError("Supabase request failed. The captured collection remains available for retry.");
  }
  if (!response.ok) {
    await response.body?.cancel();
    let hint = "Check database access and retry.";
    if (response.status === 404) hint = "Apply the database migration with npm run db:migrate first.";
    if (response.status === 401 || response.status === 403) hint = "Check SUPABASE_SECRET_KEY and database grants.";
    throw new CollectionStorageError(`Supabase returned HTTP ${response.status}. ${hint}`);
  }

  try {
    const summary = summarySchema.parse(await response.json());
    if (summary.player_tag !== collection.player_tag || summary.battles_received !== collection.battles.length) {
      throw new Error();
    }
    return summary;
  } catch {
    throw new CollectionStorageError("Supabase returned an invalid collection summary. Retry is safe.");
  }
}
