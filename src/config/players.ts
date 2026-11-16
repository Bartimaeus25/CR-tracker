export const trackedPlayers = [
  { name: "Sprengmeister", tag: "#2CVGR2R8R" },
  { name: "Bartimaues", tag: "#9Q2PQLG0L" },
  { name: "Retrum", tag: "#8V22J2U02" },
] as const;

export const comparisonCookie = "rivalry-comparison";
export const defaultComparison = [trackedPlayers[0], trackedPlayers[1]] as const;

/** Only configured, distinct players can be selected. */
export function resolveComparison(first?: string, second?: string) {
  const left = trackedPlayers.find((player) => player.tag === first);
  const right = trackedPlayers.find((player) => player.tag === second);
  return left && right && left.tag !== right.tag
    ? [left, right] as const
    : defaultComparison;
}
