import { Mail } from "lucide-react";
import { PageHeading } from "@/components/dashboard/ui";
import { ReportControls } from "@/components/dashboard/report-controls";
import { loadDashboardData } from "@/lib/dashboard/load";
import { buildReport, reportWindow } from "@/lib/reports/summary";
import { getReportStatus, getReportRecipients } from "@/lib/reports/send";
import { displayDate } from "@/lib/dashboard/format";

export default async function ReportsPage() {
  const now = new Date();
  const status = await getReportStatus();
  const recipients = getReportRecipients();
  const report = buildReport(
    await loadDashboardData("all"),
    reportWindow("manual", now),
    now,
  );
  return (
    <>
      <PageHeading
        title="Email reports"
        description="A short recap, whenever you need it."
      />
      <section className="panel reports-panel">
        <div className="panel-heading">
          <span className="icon-tile">
            <Mail size={18} />
          </span>
          <div>
            <h2>
              {status.enabled
                ? "Daily at 07:00 Berlin"
                : "Daily reports · setup pending"}
            </h2>
            <p>
              Previous calendar day · collection health, head-to-head results &
              crowns
            </p>
          </div>
        </div>
        <p className="panel-footnote">
          Recipients: {recipients.join(" and ")}. Reports use stored data and do
          not trigger collection.
        </p>
        {!status.enabled && (
          <p className="panel-footnote">
            Email delivery needs to be verified before reports can be enabled.
            The planned daily time is 07:00 Berlin.
          </p>
        )}
        <ReportControls enabled={status.enabled} />
        {status.latest && (
          <p className="panel-footnote">
            Last attempt: {displayDate(status.latest.created_at, true)} ·{" "}
            {status.latest.status} · accepted recipients:{" "}
            {status.latest.accepted_count}/{recipients.length}. Mail-server
            acceptance does not confirm inbox delivery.
          </p>
        )}
        <details className="report-preview">
          <summary>Preview the last 24 hours</summary>
          <pre>{report.text}</pre>
        </details>
      </section>
    </>
  );
}
