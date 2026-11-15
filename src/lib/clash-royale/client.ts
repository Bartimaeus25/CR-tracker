import "server-only";
import { z } from "zod";

const API_BASE_URL = "https://proxy.royaleapi.dev/v1";
const MAX_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 30_000;

const tagSchema = z.string().regex(/^#[0289PYLQGRJCUV]+$/);
export const playerSchema = z.object({
  tag: tagSchema,
  name: z.string().min(1),
  trophies: z.number().int().nonnegative(),
}).passthrough();

const participantSchema = z.object({
  tag: tagSchema,
  name: z.string(),
  crowns: z.number().int().nonnegative(),
  cards: z.array(z.object({ id: z.number().int(), name: z.string() }).passthrough()),
}).passthrough();

export const battleSchema = z.object({
  type: z.string(),
  battleTime: z.string().regex(/^\d{8}T\d{6}\.\d{3}Z$/),
  gameMode: z.object({ id: z.number().int(), name: z.string().optional() }).passthrough(),
  team: z.array(participantSchema).min(1),
  opponent: z.array(participantSchema).min(1),
}).passthrough();

export type ClashPlayer = z.infer<typeof playerSchema>;
export type ClashBattle = z.infer<typeof battleSchema>;

export const upcomingChestsSchema = z.object({
  items: z.array(z.object({
    index: z.number().int().nonnegative(),
    name: z.string(),
  }).passthrough()),
}).passthrough();

export type UpcomingChests = z.infer<typeof upcomingChestsSchema>;

export class ClashRoyaleApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ClashRoyaleApiError";
  }
}

export function normalizePlayerTag(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/^#?/, "#");
  if (!tagSchema.safeParse(normalized).success) {
    throw new ClashRoyaleApiError("Invalid Clash Royale player tag.");
  }
  return normalized;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter === null) return 500 * 2 ** attempt;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(retryAfter);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : 500 * 2 ** attempt;
}

function httpError(status: number): ClashRoyaleApiError {
  const hints: Record<number, string> = {
    401: "Check CLASH_ROYALE_API_KEY.",
    403: "Check the API key and its RoyaleAPI proxy IP allowlist (45.79.218.79).",
    404: "Check the configured player tag.",
    429: "The API rate limit was reached. Try again later.",
  };
  return new ClashRoyaleApiError(
    `Clash Royale API returned HTTP ${status}. ${hints[status] ?? "Try again later."}`,
    status,
  );
}

export class ClashRoyaleClient {
  private readonly apiKey: string;

  constructor(
    apiKey = process.env.CLASH_ROYALE_API_KEY,
    private readonly fetcher: typeof fetch = fetch,
    private readonly sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
  ) {
    if (!apiKey?.trim()) {
      throw new ClashRoyaleApiError("Set CLASH_ROYALE_API_KEY in .env.local or the process environment.");
    }
    this.apiKey = apiKey.trim();
  }

  async getPlayer(tag: string): Promise<ClashPlayer> {
    const normalized = normalizePlayerTag(tag);
    const player = await this.request(`/players/${encodeURIComponent(normalized)}`, playerSchema);
    if (player.tag !== normalized) {
      throw new ClashRoyaleApiError("The API returned a profile for an unexpected player tag.");
    }
    return player;
  }

  getBattlelog(tag: string): Promise<ClashBattle[]> {
    return this.request(
      `/players/${encodeURIComponent(normalizePlayerTag(tag))}/battlelog`,
      z.array(battleSchema),
    );
  }

  getUpcomingChests(tag: string): Promise<UpcomingChests> {
    return this.request(
      `/players/${encodeURIComponent(normalizePlayerTag(tag))}/upcomingchests`,
      upcomingChestsSchema,
    );
  }

  private async request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let response: Response;
      try {
        response = await this.fetcher(`${API_BASE_URL}${path}`, {
          headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json" },
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        if (attempt < MAX_ATTEMPTS - 1) {
          await this.sleep(500 * 2 ** attempt);
          continue;
        }
        throw new ClashRoyaleApiError("Clash Royale API request failed after 3 attempts. Check connectivity or try again later.");
      }

      if (!response.ok) {
        const delay = retryDelay(response, attempt);
        await response.body?.cancel();
        if ((response.status === 429 || response.status >= 500) && attempt < MAX_ATTEMPTS - 1 && delay <= MAX_RETRY_DELAY_MS) {
          await this.sleep(delay);
          continue;
        }
        throw httpError(response.status);
      }

      try {
        const parsed = schema.safeParse(await response.json());
        if (parsed.success) return parsed.data;
      } catch {
        // Response bodies and validation details can contain sensitive upstream data.
      }
      throw new ClashRoyaleApiError("Clash Royale API returned an invalid response.");
    }
    throw new ClashRoyaleApiError("Clash Royale API request attempts exhausted.");
  }
}
