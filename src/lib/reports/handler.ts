import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ReportResult } from "./send";

export function createReportHandler(
  secret: string | undefined,
  dependencies: {
    deliver(kind: "daily" | "manual"): Promise<ReportResult>;
    verify(): Promise<void>;
  },
) {
  return async (request: Request) => {
    const expected = new TextEncoder().encode(secret ?? "");
    const provided = new TextEncoder().encode(
      request.headers.get("x-collection-secret") ?? "",
    );
    const headers = { "Cache-Control": "no-store" };
    if (expected.length < 32)
      return Response.json(
        { ok: false, message: "Report configuration unavailable." },
        { status: 503, headers },
      );
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(expected, provided)
    )
      return Response.json(
        { ok: false, message: "Unauthorized." },
        { status: 401, headers },
      );
    if (request.method !== "POST")
      return Response.json(
        { ok: false, message: "POST required." },
        { status: 405, headers },
      );
    let kind: "daily" | "manual" | "verify-smtp";
    try {
      kind = z
        .object({ kind: z.enum(["daily", "manual", "verify-smtp"]) })
        .strict()
        .parse(await request.json()).kind;
    } catch {
      return Response.json(
        { ok: false, message: "Invalid report request." },
        { status: 400, headers },
      );
    }
    try {
      if (kind === "verify-smtp") {
        await dependencies.verify();
        return Response.json(
          {
            ok: true,
            message:
              "SMTP connection and authentication verified. No email was sent.",
          },
          { headers },
        );
      }
      const result = await dependencies.deliver(kind);
      console.info(JSON.stringify({ event: "email_report", kind, ...result }));
      return Response.json(result, { status: result.ok ? 200 : 409, headers });
    } catch (error) {
      const diagnostic =
        error instanceof Error &&
        "code" in error &&
        typeof error.code === "string" &&
        /^[A-Z0-9_]{2,64}$/.test(error.code)
          ? error.code
          : error instanceof Error
            ? error.name
            : "UNKNOWN";
      console.error(
        JSON.stringify({ event: "email_report", kind, ok: false, diagnostic }),
      );
      return Response.json(
        {
          ok: false,
          message:
            "Report service unavailable. Check its server configuration and logs.",
          ...(kind === "verify-smtp" ? { diagnostic } : {}),
        },
        { status: 502, headers },
      );
    }
  };
}
