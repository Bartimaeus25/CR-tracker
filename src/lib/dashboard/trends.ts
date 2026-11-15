import { isDirectMatch, perspective, playerMatches } from "./stats";
import type { Match } from "./types";

export type Period = "daily" | "weekly" | "monthly" | "yearly";
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function periodKey(time: string, period: Period) {
  const parts = dateFormatter.formatToParts(new Date(time));
  const get = (type: string) =>
    parts.find((value) => value.type === type)!.value;
  const day = `${get("year")}-${get("month")}-${get("day")}`;
  if (period === "yearly") return day.slice(0, 4);
  if (period === "monthly") return day.slice(0, 7);
  if (period === "weekly") {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
  }
  return day;
}

export function periodStats(
  matches: Match[],
  tags: string[],
  period: Period,
  directOnly = true,
) {
  const rows = new Map<
    string,
    {
      period: string;
      label: string;
      firstWin: number;
      firstLoss: number;
      firstDraw: number;
      secondWin: number;
      secondLoss: number;
      secondDraw: number;
    }
  >();
  const unique = [
    ...new Map(matches.map((match) => [match.id, match])).values(),
  ];
  for (const match of unique) {
    if (directOnly && !isDirectMatch(match, tags[0], tags[1])) continue;
    if (!tags.some((tag) => perspective(match, tag)?.result)) continue;
    const key = periodKey(match.time, period);
    const date = new Date(
      `${key.length === 4 ? `${key}-01-01` : key.length === 7 ? `${key}-01` : key}T12:00:00Z`,
    );
    const label =
      period === "yearly"
        ? key
        : new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Berlin",
            ...(period === "monthly"
              ? { month: "short", year: "numeric" }
              : { day: "2-digit", month: "short", year: "numeric" }),
          }).format(date);
    const row = rows.get(key) ?? {
      period: key,
      label: period === "weekly" ? `Week of ${label}` : label,
      firstWin: 0,
      firstLoss: 0,
      firstDraw: 0,
      secondWin: 0,
      secondLoss: 0,
      secondDraw: 0,
    };
    tags.slice(0, 2).forEach((tag, index) => {
      const result = perspective(match, tag)?.result;
      if (!result) return;
      const field =
        `${index === 0 ? "first" : "second"}${result === "win" ? "Win" : result === "loss" ? "Loss" : "Draw"}` as
          | "firstWin"
          | "firstLoss"
          | "firstDraw"
          | "secondWin"
          | "secondLoss"
          | "secondDraw";
      row[field]++;
    });
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.period.localeCompare(b.period));
}

export function rivalryFacts(matches: Match[], tag: string) {
  const recorded = playerMatches(matches, tag).reverse();
  let bouncebacks = 0;
  let previous: ReturnType<typeof perspective> = null;
  let firstRoundWins = 0,
    firstRoundConversions = 0,
    sweeps = 0;
  for (const match of recorded) {
    const view = perspective(match, tag);
    if (view?.result === "win" && previous?.result === "loss") bouncebacks++;
    if (match.isDuel && view?.result) {
      if (view.games[0].result === "win") {
        firstRoundWins++;
        if (view.result === "win") firstRoundConversions++;
      }
      if (
        view.result === "win" &&
        view.games.length === 2 &&
        view.games.every((game) => game.result === "win")
      )
        sweeps++;
    }
    previous = view;
  }
  return { bouncebacks, firstRoundWins, firstRoundConversions, sweeps };
}
