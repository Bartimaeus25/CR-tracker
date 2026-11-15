"use server";

export async function sendSummaryEmail(): Promise<{
  ok: boolean;
  message: string;
}> {
  const url = process.env.SUPABASE_URL,
    secret = process.env.COLLECTION_CRON_SECRET;
  if (!url || !secret)
    return {
      ok: false,
      message: "Email reports are not configured on this server.",
    };
  try {
    const response = await fetch(
      new URL("/functions/v1/send-rivalry-report", url),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-collection-secret": secret,
        },
        body: JSON.stringify({ kind: "manual" }),
        redirect: "error",
        signal: AbortSignal.timeout(120_000),
      },
    );
    const result = await response.json();
    if (typeof result.ok !== "boolean" || typeof result.message !== "string")
      throw new Error();
    return { ok: result.ok, message: result.message };
  } catch {
    return {
      ok: false,
      message:
        "Email service could not be reached. Check delivery status before retrying.",
    };
  }
}
