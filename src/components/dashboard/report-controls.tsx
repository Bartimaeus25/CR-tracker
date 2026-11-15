"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { sendSummaryEmail } from "@/app/reports/actions";

export function ReportControls({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  return (
    <div className="report-controls">
      <button
        className="button button-secondary"
        type="button"
        disabled={pending || !enabled}
        aria-busy={pending}
        onClick={() => {
          setFeedback(null);
          startTransition(async () => {
            try {
              setFeedback(await sendSummaryEmail());
            } catch {
              setFeedback({
                ok: false,
                message:
                  "Report request failed. Check delivery status before retrying.",
              });
            }
          });
        }}
      >
        <Mail size={15} />
        {pending ? "Sending summary…" : "Email last 24 hours"}
      </button>
      {feedback && (
        <p
          className={feedback.ok ? "win-text" : "loss-text"}
          role={feedback.ok ? "status" : "alert"}
        >
          {feedback.message}
        </p>
      )}
      <p className="panel-footnote">
        Sends to both configured recipients. At most one on-demand request every
        15 minutes.
      </p>
    </div>
  );
}
