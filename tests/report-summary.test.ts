import assert from "node:assert/strict";
import test from "node:test";
import { buildReport, reportWindow } from "../src/lib/reports/summary";
import type {
  DashboardData,
  Player,
  Participant,
  Match,
} from "../src/lib/dashboard/types";

function player(tag: string, name: string): Player {
  return {
    tag,
    name,
    hasProfile: true,
    trophies: 1,
    bestTrophies: 1,
    level: 1,
    kingLevel: 1,
    clan: null,
    arena: null,
    avatar: null,
    cards: 0,
    deck: [],
    badges: [],
    chests: [],
    chestsCollected: null,
    lastCollected: "2026-11-15T08:30:00Z",
  };
}
function participant(tag: string, side: number, crowns: number): Participant {
  return {
    tag,
    name: tag,
    side,
    crowns,
    cards: [],
    trophyChange: null,
    kingTowerHitPoints: null,
    elixirLeaked: null,
    rounds: [],
  };
}
function data(): DashboardData {
  return {
    scope: "all",
    players: [player("#P0", "First"), player("#P2", "Second")],
    matches: [],
    observations: [],
    collectionStarted: null,
    lastCollected: null,
  };
}
function match(id: string, time: string): Match {
  return {
    id,
    time,
    type: "friendly",
    mode: "Friendly",
    modeId: 1,
    rawMode: "",
    isDuel: false,
    rated: true,
    participants: [participant("#P0", 0, 1), participant("#P2", 1, 0)],
  };
}

test("daily report uses the previous Berlin calendar day including DST changes", () => {
  const spring = reportWindow("daily", new Date("2026-03-30T07:00:00Z"));
  assert.equal(spring.start, "2026-03-28T23:00:00.000Z");
  assert.equal(spring.end, "2026-03-29T22:00:00.000Z");
  assert.equal(
    Date.parse(spring.end) - Date.parse(spring.start),
    23 * 3600_000,
  );
  const fall = reportWindow("daily", new Date("2026-10-26T08:00:00Z"));
  assert.equal(fall.start, "2026-10-24T22:00:00.000Z");
  assert.equal(fall.end, "2026-10-25T23:00:00.000Z");
  assert.equal(Date.parse(fall.end) - Date.parse(fall.start), 25 * 3600_000);
});

test("manual report uses exactly the last 24 hours", () => {
  const window = reportWindow("manual", new Date("2026-11-15T09:00:00Z"));
  assert.equal(window.start, "2026-11-14T09:00:00.000Z");
  assert.equal(window.end, "2026-11-15T09:00:00.000Z");
});

test("summary is neutral, deduplicates matches, and excludes random opponents and end boundary", () => {
  const input = data();
  const start = match("start", "2026-11-14T09:00:00Z");
  const random = match("random", "2026-11-14T11:00:00Z");
  random.participants[1].tag = "#OTHER";
  input.matches = [start, start, random, match("end", "2026-11-15T09:00:00Z")];
  input.observations = [
    { tag: "#P0", time: "2026-11-14T12:00:00Z", trophies: 1 },
  ];
  const report = buildReport(
    input,
    reportWindow("manual", new Date("2026-11-15T09:00:00Z")),
    new Date("2026-11-15T09:00:00Z"),
  );
  assert.ok(report.text.includes("Head-to-head: 1 recorded matches"));
  assert.ok(report.text.includes("Wins: First 1 · Second 0"));
  assert.ok(report.text.includes("First: 1 crowns earned / 0 conceded"));
  assert.ok(report.text.includes("Second: 0 crowns earned / 1 conceded"));
  assert.ok(report.text.includes("1 saved profile updates"));
  assert.deepEqual(report.stalePlayers, []);
});

test("summary flags stale and never-collected players without inventing successful collection", () => {
  const input = data();
  input.players[0].lastCollected = null;
  input.players[1].lastCollected = "2026-11-15T07:00:00Z";
  const report = buildReport(
    input,
    reportWindow("manual", new Date("2026-11-15T09:00:00Z")),
    new Date("2026-11-15T09:00:00Z"),
  );
  assert.deepEqual(report.stalePlayers, ["#P0", "#P2"]);
  assert.ok(report.text.includes("attention needed"));
  assert.ok(report.text.includes("last saved never"));
  assert.ok(report.text.includes("No head-to-head matches"));
});

test("report scores duel series by rounds while crowns include all individual rounds", () => {
  const input = data();
  const duel = match("duel", "2026-11-14T12:00:00Z");
  duel.isDuel = true;
  const scores = [
    [3, 1],
    [0, 1],
    [0, 1],
  ];
  for (const [side, participant] of duel.participants.entries()) {
    participant.rounds = scores.map((score) => ({
      crowns: score[side],
      cards: [],
      kingTowerHitPoints: null,
      elixirLeaked: null,
    }));
    participant.crowns = scores.reduce((sum, score) => sum + score[side], 0);
  }
  input.matches = [duel];
  const report = buildReport(
    input,
    reportWindow("manual", new Date("2026-11-15T09:00:00Z")),
    new Date("2026-11-15T09:00:00Z"),
  );
  assert.ok(report.text.includes("Wins: First 0 · Second 1"));
  assert.ok(report.text.includes("Scored games/duel rounds: 3"));
  assert.ok(report.text.includes("First: 3 crowns earned / 3 conceded"));
});

test("full-period health distinguishes healthy coverage from a historical update gap", () => {
  const input = data();
  const now = new Date("2026-11-15T09:00:00Z");
  const window = reportWindow("manual", now);
  for (const player of input.players) {
    for (let hour = 0; hour < 24; hour++)
      input.observations.push({
        tag: player.tag,
        time: new Date(
          Date.parse(window.start) + hour * 3600_000,
        ).toISOString(),
        trophies: 1,
      });
  }
  assert.ok(
    buildReport(input, window, now).text.includes(
      "First period coverage: all good",
    ),
  );
  input.observations = input.observations.filter(
    (point) =>
      !(point.tag === "#P0" && point.time === "2026-11-14T15:00:00.000Z"),
  );
  const report = buildReport(input, window, now);
  assert.ok(report.text.includes("First period coverage: a data-update gap"));
  assert.ok(report.text.includes("Second period coverage: all good"));
});
