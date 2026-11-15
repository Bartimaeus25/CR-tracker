"use client";

import { useState } from "react";
import { Activity, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { displayDate, displayRate, displayTime } from "@/lib/dashboard/format";
import { rollingWinRates } from "@/lib/dashboard/stats";
import type { Match, Player, TrophyObservation } from "@/lib/dashboard/types";
import { EmptyState } from "./ui";

export function PerformanceChart({
  matches,
  players,
}: {
  matches: Match[];
  players: Player[];
}) {
  const [windowSize, setWindowSize] = useState(10);
  const points = rollingWinRates(
    matches,
    players.map((player) => player.tag),
    windowSize,
  );
  const lastFirst = [...points]
    .reverse()
    .find((point) => point.first !== undefined);
  const lastSecond = [...points]
    .reverse()
    .find((point) => point.second !== undefined);
  return (
    <section className="panel performance-panel">
      <div className="chart-heading">
        <div className="panel-heading">
          <span className="icon-tile">
            <Activity size={18} />
          </span>
          <div>
            <h2>Performance over time</h2>
            <p>Recent form · changes only after a scored match</p>
          </div>
        </div>
        <label className="chart-select">
          <span className="sr-only">Rolling win rate window</span>
          <select
            value={windowSize}
            onChange={(event) => setWindowSize(Number(event.target.value))}
          >
            {[5, 10, 20].map((value) => (
              <option key={value} value={value}>
                Last {value} battles
              </option>
            ))}
          </select>
        </label>
      </div>
      {points.length > 1 ? (
        <>
          <div className="chart-legend">
            {players.map((player, index) => (
              <div key={player.tag}>
                <span className={`player-dot player-color-${index}`} />
                <span>{player.name}</span>
                <strong>
                  {displayRate(
                    (index === 0 ? lastFirst?.first : lastSecond?.second) ??
                      null,
                  )}
                </strong>
              </div>
            ))}
          </div>
          <div
            className="chart-container"
            role="group"
            aria-label={`Rolling win rate for ${players.map((player) => player.name).join(" and ")}, using up to ${windowSize} scored matches per point.`}
          >
            <ResponsiveContainer width="100%" height={220} minWidth={0}>
              <LineChart
                data={points}
                margin={{ top: 10, right: 12, left: -22, bottom: 0 }}
                accessibilityLayer
              >
                <CartesianGrid
                  stroke="#283145"
                  strokeDasharray="3 5"
                  vertical={false}
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
                  minTickGap={45}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fill: "#8995aa", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="chart-tooltip">
                        <strong>{displayDate(Number(label), true)}</strong>
                        {payload.map((item) => {
                          const point = points.find(
                            (value) => value.time === Number(label),
                          );
                          const sample =
                            item.dataKey === "first"
                              ? point?.firstSample
                              : point?.secondSample;
                          return (
                            <span key={String(item.dataKey)}>
                              <i style={{ background: item.color }} />
                              {item.name}
                              <b>{Number(item.value).toFixed(1)}%</b>
                              <small>n={sample}</small>
                            </span>
                          );
                        })}
                      </div>
                    ) : null
                  }
                />
                <Line
                  dataKey="first"
                  name={players[0]?.name}
                  type="stepAfter"
                  stroke="#78a6ff"
                  strokeWidth={2.5}
                  dot={{ r: 2.5, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  dataKey="second"
                  name={players[1]?.name}
                  type="stepAfter"
                  stroke="#edc37c"
                  strokeWidth={2.5}
                  dot={{ r: 2.5, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-footnote">
            Each dot is a completed match (a duel counts as one series). The
            step holds between matches; it is not a prediction. Win rate uses
            the latest {windowSize} scored matches, or all available if fewer.
            Hover or use arrow keys for the date, time and sample size.
          </p>
        </>
      ) : (
        <EmptyState
          title="Performance history is building"
          description="At least two scored match times are needed to draw a trend."
        />
      )}
    </section>
  );
}

export function TrophyChart({
  observations,
  player,
  index,
}: {
  observations: TrophyObservation[];
  player: Player;
  index: number;
}) {
  const points = observations
    .filter((point) => point.tag === player.tag)
    .map((point) => ({
      time: Date.parse(point.time),
      trophies: point.trophies,
    }));
  const changed = new Set(points.map((point) => point.trophies)).size > 1;
  return (
    <section className="panel trophy-panel">
      <div className="panel-heading">
        <span className="icon-tile">
          <TrendingUp size={18} />
        </span>
        <div>
          <h2>Trophy observations</h2>
          <p>{points.length} stored profile observations</p>
        </div>
      </div>
      {changed ? (
        <div
          className="chart-container"
          role="group"
          aria-label={`Observed trophy totals for ${player.name}`}
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
                tickFormatter={displayTime}
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
                name="Trophies"
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
          title="Waiting for a trophy change"
          description="No trophy change has been observed yet. A trend will appear when a future profile records a different total."
        />
      )}
    </section>
  );
}
