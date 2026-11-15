import nodemailer from "nodemailer";
import { createReportHandler } from "../../../src/lib/reports/handler";
import { sendStoredReport } from "../../../src/lib/reports/send";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

function transport() {
  const password = Deno.env.get("REPORT_SMTP_PASSWORD");
  if (!password) throw new Error("Missing report email configuration.");
  return nodemailer.createTransport({
    host: "smtp.web.de",
    port: 465,
    secure: true,
    auth: { user: "jan.portius@web.de", pass: password },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

Deno.serve(
  createReportHandler(Deno.env.get("COLLECTION_CRON_SECRET"), {
    verify: async () => {
      const smtp = transport();
      try {
        await smtp.verify();
      } finally {
        smtp.close();
      }
    },
    deliver: (kind) =>
      sendStoredReport(kind, async (report) => {
        const smtp = transport();
        try {
          const info = await smtp.sendMail({
            from: "Rivalry Tracker <jan.portius@web.de>",
            to: [...report.to],
            subject: report.subject,
            text: report.text,
            messageId: report.messageId,
          });
          return info.accepted.length;
        } finally {
          smtp.close();
        }
      }),
  }),
);
