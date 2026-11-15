import "server-only";

export type HeartbeatStatus =
  "sent" | "not_configured" | "failed" | "not_attempted";

/** Only the fixed monitoring provider receives an empty POST; never send game data or credentials. */
export async function sendCollectionHeartbeat(
  configuredUrl: string | undefined,
  fetcher: typeof fetch = fetch,
  sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
): Promise<HeartbeatStatus> {
  if (!configuredUrl?.trim()) return "not_configured";
  let url: URL;
  try {
    url = new URL(configuredUrl.trim());
    if (
      url.protocol !== "https:" ||
      url.hostname !== "hc-ping.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
        url.pathname,
      )
    )
      return "failed";
  } catch {
    return "failed";
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(url, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      });
      // The provider also returns HTTP 200 for unknown check IDs: require its exact success body.
      const body = await response.text();
      if (response.ok && body.trim() === "OK") return "sent";
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      )
        return "failed";
    } catch {
      /* Never log the private ping URL or transport exception. */
    }
    if (attempt < 2) await sleep(250 * 2 ** attempt);
  }
  return "failed";
}
