"use client";
import type { Match } from "@/lib/dashboard/types";

export function ModeFilter({
  matches,
  selected,
  onChange,
}: {
  matches: Match[];
  selected: string;
  onChange: (mode: string) => void;
}) {
  const modes = [...new Set(matches.map((match) => match.mode))].sort();
  return (
    <div className="mode-filter" aria-label="Filter analytics by game mode">
      <button
        type="button"
        aria-pressed={selected === "all"}
        onClick={() => onChange("all")}
      >
        All modes <small>{matches.length}</small>
      </button>
      {modes.map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={selected === mode}
          onClick={() => onChange(mode)}
        >
          {mode}
          <small>{matches.filter((match) => match.mode === mode).length}</small>
        </button>
      ))}
    </div>
  );
}
