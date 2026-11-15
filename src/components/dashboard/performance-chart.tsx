"use client";

import { useState } from "react";
import { Activity, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { displayDate } from "@/lib/dashboard/format";
import { periodStats, type Period } from "@/lib/dashboard/trends";
import type { Match, Player, TrophyObservation } from "@/lib/dashboard/types";
import { EmptyState } from "./ui";

export function PerformanceChart({
  matches,
  players,
  variant = "rivalry",
}: {
  matches: Match[];
  players: Player[];
  variant?: "rivalry" | "overall";
}) {
  const [period, setPeriod] = useState<Period>("daily");
  const direct = variant === "rivalry";
  const points = periodStats(
    matches,
    players.map((player) => player.tag),
    period,
    direct,
  );
  return (
    <section className="panel performance-panel">
      <div className="chart-heading">
        <div className="panel-heading">
          <span className="icon-tile">
            <Activity size={18} />
          </span>
          <div>
            <h2>Performance over time</h2>
            <p>
              {direct
                ? "Head-to-head outcomes"
                : "Results against all opponents"}{" "}
              grouped by period
            </p>
          </div>
        </div>
        <label className="chart-select">
          <span className="sr-only">Performance grouping</span>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
          >
            {(["daily", "weekly", "monthly", "yearly"] as const).map(
              (value) => (
                <option value={value} key={value}>
                  {value[0].toUpperCase() + value.slice(1)}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      <div className="chart-legend">
        {players.map((player, index) => (
          <div key={player.tag}>
            <span className={`player-dot player-color-${index}`} />
            <span>
              {player.name}
              {direct ? " wins" : ""}
            </span>
          </div>
        ))}
        <div>
          <span className="player-dot" style={{ background: "#8792a7" }} />
          Draws
        </div>
        {!direct && (
          <div>
            <span className="player-dot" style={{ background: "#de8c99" }} />
            Losses
          </div>
        )}
      </div>
      {points.length ? (
        <div
          className="chart-container"
          role="group"
          aria-label={`${period} stacked match results`}
        >
          <ResponsiveContainer width="100%" height={250} minWidth={0}>
            <BarChart
              data={points}
              margin={{ top: 10, right: 12, left: -20, bottom: 5 }}
              accessibilityLayer
            >
              <CartesianGrid
                stroke="#283145"
                strokeDasharray="3 5"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "#8995aa", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#8995aa", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "#ffffff06" }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="chart-tooltip">
                      <strong>{label}</strong>
                      {payload.map((item) => (
                        <span key={String(item.dataKey)}>
                          <i style={{ background: item.color }} />
                          {item.name}
                          <b>{String(item.value)}</b>
                        </span>
                      ))}
                    </div>
                  ) : null
                }
              />
              <Bar
                dataKey="firstWin"
                name={`${players[0]?.name} wins`}
                stackId="first"
                fill="#78a6ff"
                maxBarSize={55}
                isAnimationActive={false}
              />
              {!direct && (
                <Bar
                  dataKey="firstLoss"
                  name={`${players[0]?.name} losses`}
                  stackId="first"
                  fill="#de8c99"
                  maxBarSize={55}
                  isAnimationActive={false}
                />
              )}
              <Bar
                dataKey="firstDraw"
                name={direct ? "Draws" : `${players[0]?.name} draws`}
                stackId="first"
                fill="#8792a7"
                maxBarSize={55}
                isAnimationActive={false}
              />
              <Bar
                dataKey="secondWin"
                name={`${players[1]?.name} wins`}
                stackId={direct ? "first" : "second"}
                fill="#edc37c"
                maxBarSize={55}
                isAnimationActive={false}
              />
              {!direct && (
                <Bar
                  dataKey="secondLoss"
                  name={`${players[1]?.name} losses`}
                  stackId="second"
                  fill="#de8c99"
                  maxBarSize={55}
                  isAnimationActive={false}
                />
              )}
              {!direct && (
                <Bar
                  dataKey="secondDraw"
                  name={`${players[1]?.name} draws`}
                  stackId="second"
                  fill="#8792a7"
                  maxBarSize={55}
                  isAnimationActive={false}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          title="No scored matches in this view"
          description="Change the mode filter or wait for more recorded matches."
        />
      )}
      <p className="chart-footnote">
        {direct
          ? "One stack per period: wins for each player plus draws."
          : `Two stacks per period: ${players[0]?.name} on the left, ${players[1]?.name} on the right. Player colors show wins; red shows losses.`}{" "}
        Counts use matches or duel series, not individual rounds. Berlin
        calendar periods; weeks start Monday. Only periods with scored matches
        are shown.
      </p>
    </section>
  );
}

export function TrophyChart({
  observations,
  player,
  index,
  metric = "trophies",
}: {
  observations: TrophyObservation[];
  player: Player;
  index: number;
  metric?: "trophies" | "rankedRating";
}) {
  const points = observations
    .filter((point) => point.tag === player.tag)
    .filter(
      (point) =>
        metric === "trophies" ||
        (point.rankedRating != null && point.rankedRating > 0),
    )
    .map((point) => ({
      time: Date.parse(point.time),
      trophies: point[metric],
    }));
  const changed = new Set(points.map((point) => point.trophies)).size > 1;
  return (
    <section className="panel trophy-panel">
      <div className="panel-heading">
        <span className="icon-tile">
          <TrendingUp size={18} />
        </span>
        <div>
          <h2>
            {player.name} ·{" "}
            {metric === "trophies" ? "trophies" : "ranked rating"}
          </h2>
          <p>{points.length} stored profile observations</p>
        </div>
      </div>
      {changed ? (
        <div
          className="chart-container"
          role="group"
          aria-label={`Observed ${metric === "trophies" ? "trophy totals" : "ranked ratings"} for ${player.name}`}
        >
          <ResponsiveContainer width="100%" height={200} minWidth={0}>
            <LineChart
              data={points}
              margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
              accessibilityLayer
            >
              <CartesianGrid
                vertical={false}
                stroke="#283145"
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(value) =>
                  new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Europe/Berlin",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                  }).format(new Date(value))
                }
                tick={{ fill: "#8995aa", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={35}
              />
              <YAxis
                domain={["dataMin - 20", "dataMax + 20"]}
                tick={{ fill: "#8995aa", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip
                labelFormatter={(label) => displayDate(Number(label), true)}
                contentStyle={{
                  background: "#1b2435",
                  border: "1px solid #38435a",
                  borderRadius: 8,
                }}
              />
              <Line
                dataKey="trophies"
                name={metric === "trophies" ? "Trophies" : "Season rating"}
                type="stepAfter"
                stroke={index === 0 ? "#78a6ff" : "#edc37c"}
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          icon="shield"
          title={
            metric === "trophies"
              ? "Waiting for a trophy change"
              : "Waiting for ranked rating history"
          }
          description={
            metric === "trophies"
              ? "No trophy change has been observed yet. A trend will appear when a future profile records a different total."
              : "At least two different positive season ratings are needed. Zero or missing ratings are excluded."
          }
        />
      )}
    </section>
  );
}
