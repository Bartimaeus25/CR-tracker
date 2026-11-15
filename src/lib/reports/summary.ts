import { isDirectMatch, playerMatches, playerStats } from "../dashboard/stats";
import { displayDate } from "../dashboard/format";
import type { DashboardData } from "../dashboard/types";

export interface ReportWindow {
  start: string;
  end: string;
  kind: "daily" | "manual";
}

function berlinParts(time: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(time);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}
function berlinMidnight(year: number, month: number, day: number) {
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const local = berlinParts(guess);
    const represented = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    guess = target - (represented - guess);
  }
  return new Date(guess).toISOString();
}

export function reportWindow(
  kind: ReportWindow["kind"],
  now = new Date(),
): ReportWindow {
  if (kind === "manual")
    return {
      kind,
      start: new Date(now.getTime() - 24 * 3600_000).toISOString(),
      end: now.toISOString(),
    };
  const local = berlinParts(now.getTime());
  return {
    kind,
    start: berlinMidnight(local.year, local.month, local.day - 1),
    end: berlinMidnight(local.year, local.month, local.day),
  };
}

/** Brief, neutral plain-text report. All data is already stored; no game API calls. */
export function buildReport(
  data: DashboardData,
  window: ReportWindow,
  now = new Date(),
) {
  const from = Date.parse(window.start),
    until = Date.parse(window.end);
  if (!Number.isFinite(from) || !Number.isFinite(until) || from >= until)
    throw new Error("Invalid report period.");
  const within = (time: string) =>
    Date.parse(time) >= from && Date.parse(time) < until;
  const [first, second] = data.players;
  const direct = playerMatches(
    data.matches.filter(
      (match) =>
        within(match.time) && isDirectMatch(match, first.tag, second.tag),
    ),
    first.tag,
  );
  const stats = data.players.map((player) => playerStats(direct, player.tag));
  const stale = data.players.filter(
    (player) =>
      !player.lastCollected ||
      now.getTime() - Date.parse(player.lastCollected) >= 2 * 3600_000,
  );
  const subject = `Rivalry ${window.kind === "daily" ? "daily report" : "summary"} · ${displayDate(window.kind === "daily" ? window.start : window.end)}`;
  const lines = [
    subject,
    `Period: ${displayDate(window.start, true)} to ${displayDate(window.end, true)} (Berlin).`,
    window.kind === "daily" ? "Previous calendar day." : "Last 24 hours.",
    "",
    `Collection: ${stale.length ? `attention needed — ${stale.map((player) => player.name).join(" and ")} has no update within two hours` : "both players updated within two hours"}.`,
    ...data.players.map(
      (player) =>
        `${player.name}: last saved ${player.lastCollected ? displayDate(player.lastCollected, true) : "never"}; ${data.observations.filter((observation) => observation.tag === player.tag && within(observation.time)).length} saved profile updates in this period.`,
    ),
    ...data.players.map((player) => {
      const times = [
        ...new Set(
          data.observations
            .filter((item) => item.tag === player.tag)
            .map((item) => Date.parse(item.time)),
        ),
      ].sort((a, b) => a - b);
      const baseline = times.filter((time) => time <= from).at(-1);
      if (baseline === undefined)
        return `${player.name} period coverage: partial history; a full-day health verdict is unavailable.`;
      const points = [
        baseline,
        ...times.filter((time) => time > from && time < until),
        until,
      ];
      const largestGap = Math.max(
        ...points.slice(1).map((time, index) => time - points[index]),
      );
      return `${player.name} period coverage: ${largestGap >= 2 * 3600_000 ? "a data-update gap of at least two hours was observed" : "all good — no data-update gaps of two hours or more"}.`;
    }),
    "",
    `Head-to-head: ${direct.length} recorded matches (${stats[0].scored} scored, ${stats[0].excluded} unscored).`,
    ...(direct.length
      ? [
          `Wins: ${first.name} ${stats[0].wins} · ${second.name} ${stats[1].wins} · draws ${stats[0].draws}.`,
          ...data.players.map(
            (player, index) =>
              `${player.name}: ${stats[index].crowns} crowns earned / ${stats[index].conceded} conceded; ${stats[index].threeCrowns} three-crown wins.`,
          ),
          `Scored games/duel rounds: ${stats[0].games}. Duel series results use round wins.`,
        ]
      : ["No head-to-head matches recorded during this period."]),
    "",
    `Generated ${displayDate(now.toISOString(), true)} (Berlin) from stored data. Saved updates include scheduled and manual collection. Earlier uncaptured games cannot be recovered.`,
  ];
  return {
    subject,
    text: lines.join("\n"),
    window,
    generatedAt: now.toISOString(),
    stalePlayers: stale.map((player) => player.tag),
  };
}
