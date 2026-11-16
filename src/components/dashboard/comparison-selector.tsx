"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Users, X } from "lucide-react";
import { changeComparison } from "@/app/actions";
import { trackedPlayers } from "@/config/players";

function ApplyButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button-secondary" disabled={pending}>
      {pending ? "Updating?" : "Compare players"}
    </button>
  );
}

export function ComparisonSelector({ pair }: { pair: string[] }) {
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState(pair[0]);
  const [second, setSecond] = useState(pair[1]);
  const [error, setError] = useState<string | null>(null);
  const names = pair.map((tag) => trackedPlayers.find((player) => player.tag === tag)?.name);

  async function apply(formData: FormData) {
    setError(null);
    try {
      await changeComparison(formData);
      panel.current?.hidePopover();
    } catch {
      setError("Could not change players. Please try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        className="button button-secondary comparison-trigger"
        popoverTarget="player-comparison"
        aria-label="Change comparison players"
        aria-expanded={open}
        title={`Change players: ${names.join(" vs ")}`}
        onClick={() => {
          setFirst(pair[0]);
          setSecond(pair[1]);
          setError(null);
        }}
      >
        <Users size={17} />
      </button>
      <div
        ref={panel}
        id="player-comparison"
        className="comparison-popover"
        popover="auto"
        onToggle={() => setOpen(panel.current?.matches(":popover-open") ?? false)}
        role="dialog"
        aria-labelledby="comparison-title"
      >
        <div className="comparison-popover-heading">
          <h2 id="comparison-title">Compare players</h2>
          <button type="button" className="comparison-close" popoverTarget="player-comparison" popoverTargetAction="hide" aria-label="Close player picker">
            <X size={16} />
          </button>
        </div>
        <form action={apply} className="comparison-selector" aria-label="Player comparison">
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
          {error && <p className="comparison-error" role="alert">{error}</p>}
          <ApplyButton />
        </form>
      </div>
    </>
  );
}
