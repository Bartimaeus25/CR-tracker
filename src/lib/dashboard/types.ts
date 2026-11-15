export type Result = "win" | "loss" | "draw";

export interface Card {
  id: number;
  name: string;
  image: string | null;
  elixir: number | null;
  evolution: number;
}

export interface Player {
  tag: string;
  name: string;
  hasProfile: boolean;
  trophies: number | null;
  bestTrophies: number | null;
  level: number | null;
  kingLevel: number | null;
  clan: string | null;
  arena: string | null;
  avatar: string | null;
  cards: number | null;
  deck: Card[];
  badges: { name: string; image: string }[];
  chests: { name: string; index: number }[];
  chestsCollected: string | null;
  lastCollected: string | null;
  rankedRating?: number | null;
  rankedLeague?: number | null;
}

export interface Participant {
  tag: string;
  name: string;
  side: number;
  crowns: number;
  cards: Card[];
  trophyChange: number | null;
  kingTowerHitPoints: number | null;
  elixirLeaked: number | null;
  rounds: DuelRound[];
}

export interface DuelRound {
  crowns: number;
  cards: Card[];
  kingTowerHitPoints: number | null;
  elixirLeaked: number | null;
}

export interface Match {
  id: string;
  time: string;
  type: string;
  mode: string;
  modeId: number | null;
  rawMode: string;
  rated: boolean;
  isDuel: boolean;
  participants: Participant[];
}

export interface TrophyObservation {
  tag: string;
  time: string;
  trophies: number;
  rankedRating?: number | null;
}

export interface DashboardData {
  scope: "direct" | "all";
  players: Player[];
  matches: Match[];
  observations: TrophyObservation[];
  collectionStarted: string | null;
  lastCollected: string | null;
}
