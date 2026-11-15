import { RivalryOverview } from "@/components/dashboard/rivalry-overview";
import { DataNotes, PageHeading } from "@/components/dashboard/ui";
import { getDashboardData } from "@/lib/dashboard/data";
import { displayDate } from "@/lib/dashboard/format";

export default async function Home() {
  const data = await getDashboardData("direct");
  const oldest = data.matches.at(-1)?.time;
  const newest = data.matches[0]?.time;
  const range =
    oldest && newest ? ` · ${displayDate(oldest)}–${displayDate(newest)}` : "";
  return (
    <>
      <PageHeading
        title="Rivalry overview"
        description={`${data.matches.length} head-to-head matches${range}`}
        lastCollected={data.lastCollected}
      />
      <RivalryOverview data={data} />
      <DataNotes data={data} />
    </>
  );
}
