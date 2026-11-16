"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { changeComparison } from "@/app/actions";
import { trackedPlayers } from "@/config/players";

function ApplyButton() {
  const { pending } = useFormStatus();
  return <button className="button button-secondary" disabled={pending}>
    {pending ? "Updating…" : "Compare players"}
  </button>;
}

export function ComparisonSelector({ pair }: { pair: string[] }) {
  const [first, setFirst] = useState(pair[0]);
  const [second, setSecond] = useState(pair[1]);
  return (
    <form action={changeComparison} className="comparison-selector" aria-label="Player comparison">
      <label>
        Player one
        <select name="first" value={first} onChange={(event) => {
          const next = event.target.value;
          if (next === second) setSecond(first);
          setFirst(next);
        }}>
          {trackedPlayers.map((player) => <option key={player.tag} value={player.tag}>{player.name}</option>)}
        </select>
      </label>
      <span className="comparison-versus">vs</span>
      <label>
        Player two
        <select name="second" value={second} onChange={(event) => {
          const next = event.target.value;
          if (next === first) setFirst(second);
          setSecond(next);
        }}>
          {trackedPlayers.map((player) => <option key={player.tag} value={player.tag}>{player.name}</option>)}
        </select>
      </label>
      <ApplyButton />
    </form>
  );
}
