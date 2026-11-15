import type { Metadata } from "next";
import { OverallStats } from "@/components/dashboard/overall-stats";
import { PageHeading, DataNotes } from "@/components/dashboard/ui";
import { getDashboardData } from "@/lib/dashboard/data";

export const metadata: Metadata = { title: "Overall stats · Rivalry" };
export default async function StatsPage() {
  const data = await getDashboardData("all");
  return (
    <>
      <PageHeading
        title="Overall stats"
        description="Trophies, Ranked and match performance against every opponent."
        lastCollected={data.lastCollected}
      />
      <OverallStats data={data} />
      <DataNotes data={data} />
    </>
  );
}
