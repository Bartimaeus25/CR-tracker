import "server-only";
import { z } from "zod";
import { loadDashboardData } from "../dashboard/load";
import { buildReport, reportWindow, type ReportWindow } from "./summary";

export function getReportRecipients(): string[] {
  return z
    .array(z.email())
    .min(1)
    .max(10)
    .parse([
      ...new Set(
        (process.env.REPORT_RECIPIENTS ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ]);
}
export interface ReportResult {
  ok: boolean;
  message: string;
}
export type MailSender = (report: {
  subject: string;
  text: string;
  to: readonly string[];
  messageId: string;
}) => Promise<number>;

async function rpc(name: string, body: unknown) {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Report storage unavailable.");
  const response = await fetch(new URL(`/rest/v1/rpc/${name}`, url), {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("Report storage unavailable.");
  }
  return response;
}

export async function getReportStatus() {
  const response = await rpc("get_rivalry_report_status", {});
  return z
    .object({
      enabled: z.boolean(),
      latest: z
        .object({
          kind: z.string(),
          status: z.string(),
          created_at: z.string(),
          accepted_count: z.number(),
        })
        .nullable(),
    })
    .parse(await response.json());
}

export async function sendStoredReport(
  kind: ReportWindow["kind"],
  send: MailSender,
): Promise<ReportResult> {
  const reportRecipients = getReportRecipients();
  const now = new Date();
  const window = reportWindow(kind, now);
  // Build first so a data-read failure does not consume a delivery claim.
  const report = buildReport(await loadDashboardData("all"), window, now);
  const key =
    kind === "daily"
      ? `daily:${window.start}`
      : `manual:${Math.floor(now.getTime() / (15 * 60_000))}`;
  const response = await rpc("claim_rivalry_report", {
    p_kind: kind,
    p_key: key,
  });
  const claim = z
    .object({
      claimed: z.boolean(),
      id: z.string().uuid().optional(),
      reason: z.string().optional(),
    })
    .parse(await response.json());
  if (!claim.claimed)
    return {
      ok: false,
      message:
        kind === "manual"
          ? "A summary was already requested recently. Please wait 15 minutes before sending another."
          : "Today's daily report has already been attempted.",
    };
  if (!claim.id) throw new Error("Invalid report claim.");
  let accepted = 0;
  try {
    accepted = await send({
      ...report,
      to: reportRecipients,
      messageId: `<${claim.id}@web.de>`,
    });
    const ok = accepted === reportRecipients.length;
    await (
      await rpc("finish_rivalry_report", {
        p_id: claim.id,
        p_accepted: accepted,
        p_ok: ok,
      })
    ).body?.cancel();
    return {
      ok,
      message: ok
        ? "Summary accepted by the mail server for both recipients."
        : "The mail server did not accept every recipient. Check report delivery status.",
    };
  } catch {
    try {
      await (
        await rpc("finish_rivalry_report", {
          p_id: claim.id,
          p_accepted: accepted,
          p_ok: false,
        })
      ).body?.cancel();
    } catch {
      /* Preserve the claim to avoid duplicate email after uncertain delivery. */
    }
    return {
      ok: false,
      message:
        "Report delivery could not be confirmed. Check delivery status before retrying.",
    };
  }
}
