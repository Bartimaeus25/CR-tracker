import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import { getDashboardData } from "../src/lib/dashboard/data";
import { buildReport, reportWindow } from "../src/lib/reports/summary";

loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
async function main() {
  const now = new Date();
  const report = buildReport(
    await getDashboardData("all"),
    reportWindow(process.argv.includes("--daily") ? "daily" : "manual", now),
    now,
  );
  await mkdir(".local/reports", { recursive: true });
  await writeFile(".local/reports/preview.txt", report.text);
  console.log(report.text);
  console.log(
    "\nPreview saved to .local/reports/preview.txt. No email or game API call was made.",
  );
}
main().catch(() => {
  console.error("Report preview could not load stored data.");
  process.exitCode = 1;
});
