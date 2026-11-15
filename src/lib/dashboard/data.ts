import "server-only";
import { cache } from "react";
import { z } from "zod";
import { trackedPlayers } from "@/config/players";
import { readSupabaseRows } from "@/lib/supabase";
import { isDirectMatch, supportsScoring } from "./stats";
import type { Card, DashboardData, DuelRound, Match, Player } from "./types";

const objectSchema = z.record(z.string(), z.unknown());
const playerRowSchema = z.object({
  tag: z.string(),
  name: z.string(),
  latest_profile: objectSchema,
  latest_upcoming_chests: objectSchema.nullable(),
  first_collected_at: z.string(),
  last_collected_at: z.string(),
});
const participantSchema = z.object({
  player_tag: z.string(),
  name: z.string(),
  side: z.number(),
  crowns: z.number(),
  cards: z.array(objectSchema),
  raw_participant: objectSchema,
});
const battleRowSchema = z.object({
  id: z.string(),
  battle_time: z.string(),
  battle_type: z.string(),
  game_mode: objectSchema,
  battle_participants: z.array(participantSchema),
});
const observationSchema = z.object({
  player_tag: z.string(),
  observed_at: z.string(),
  upcoming_chests_error: z.string().nullable(),
  player_snapshots: z.object({
    profile: objectSchema,
    upcoming_chests: objectSchema.nullable(),
  }),
});
const duelRoundSchema = z
  .object({
    crowns: z.number().int().min(0).max(3),
  })
  .passthrough();

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asset(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "api-assets.clashroyale.com"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function cards(value: unknown): Card[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const card = record(item);
    const id = numeric(card.id);
    if (id === null) return [];
    const icons = record(card.iconUrls);
    const evolution = numeric(card.evolutionLevel) ?? 0;
    return [
      {
        id,
        name: text(card.name) ?? "Unnamed card",
        image:
          asset(evolution === 1 ? icons.evolutionMedium : null) ??
          asset(icons.medium),
        elixir: numeric(card.elixirCost),
        evolution,
      },
    ];
  });
}

function modeName(type: string, raw: string): string {
  if (type.toLowerCase() === "pathoflegend") return "Ranked";
  if (type.toLowerCase() === "pvp") return "Trophy Road";
  if (type.toLowerCase() === "friendly")
    return /duel/i.test(raw) ? "Friendly duel" : "Friendly";
  if (type.toLowerCase() === "trail") return "Event";
  return raw.replace(/_/g, " ") || type;
}

export const getDashboardData = cache(
  async (scope: "direct" | "all" = "direct"): Promise<DashboardData> => {
    const [playerRows, battleRows, observations] = await Promise.all([
      readSupabaseRows("players", "*", "tag.asc", playerRowSchema),
      readSupabaseRows(
        "battles",
        "id,battle_time,battle_type,game_mode,battle_participants(player_tag,name,side,crowns,cards,raw_participant)",
        "id.asc",
        battleRowSchema,
      ),
      readSupabaseRows(
        "player_observations",
        "player_tag,observed_at,upcoming_chests_error,player_snapshots(profile,upcoming_chests)",
        "observed_at.asc,player_tag.asc",
        observationSchema,
      ),
    ]);
    const players: Player[] = trackedPlayers.map((configured) => {
      const row = playerRows.find((player) => player.tag === configured.tag);
      const profile = row?.latest_profile ?? {};
      const badges = Array.isArray(profile.badges)
        ? profile.badges.flatMap((item) => {
            const badge = record(item);
            const image = asset(record(badge.iconUrls).large);
            return image
              ? [{ name: text(badge.name) ?? "Player badge", image }]
              : [];
          })
        : [];
      const chestItems = row?.latest_upcoming_chests?.items;
      return {
        tag: configured.tag,
        name: text(profile.name) ?? row?.name ?? configured.name,
        hasProfile: Boolean(row),
        trophies: numeric(profile.trophies),
        bestTrophies: numeric(profile.bestTrophies),
        level: numeric(profile.expLevel),
        kingLevel: numeric(profile.kingTowerLevel),
        clan: text(record(profile.clan).name),
        arena: text(record(profile.arena).name),
        avatar:
          badges.find((badge) => badge.name === "BattleWins")?.image ??
          badges[0]?.image ??
          null,
        cards: Array.isArray(profile.cards) ? profile.cards.length : null,
        deck: cards(profile.currentDeck),
        badges,
        chests: Array.isArray(chestItems)
          ? chestItems
              .flatMap((item) => {
                const chest = record(item);
                const name = text(chest.name);
                const index = numeric(chest.index);
                return name && index !== null ? [{ name, index }] : [];
              })
              .sort((left, right) => left.index - right.index)
          : [],
        chestsCollected:
          observations
            .filter(
              (observation) =>
                observation.player_tag === configured.tag &&
                !observation.upcoming_chests_error &&
                observation.player_snapshots.upcoming_chests !== null,
            )
            .at(-1)?.observed_at ?? null,
        lastCollected: row?.last_collected_at ?? null,
      };
    });
    const trackedTags = new Set<string>(
      trackedPlayers.map((player) => player.tag),
    );
    const matches: Match[] = battleRows
      .filter((row) =>
        row.battle_participants.some((participant) =>
          trackedTags.has(participant.player_tag),
        ),
      )
      .map((row) => {
        const participants = row.battle_participants
          .map((participant) => {
            const parsedRounds = z
              .array(duelRoundSchema)
              .safeParse(participant.raw_participant.rounds ?? []);
            const rounds: DuelRound[] = parsedRounds.success
              ? parsedRounds.data.map((round) => {
                  return {
                    crowns: round.crowns,
                    cards: cards(round.cards),
                    kingTowerHitPoints: numeric(round.kingTowerHitPoints),
                    elixirLeaked: numeric(round.elixirLeaked),
                  };
                })
              : [];
            return {
              tag: participant.player_tag,
              name: participant.name,
              side: participant.side,
              crowns: participant.crowns,
              cards: rounds.length ? [] : cards(participant.cards),
              rounds,
              trophyChange: numeric(participant.raw_participant.trophyChange),
              kingTowerHitPoints: numeric(
                participant.raw_participant.kingTowerHitPoints,
              ),
              elixirLeaked: numeric(participant.raw_participant.elixirLeaked),
            };
          })
          .sort(
            (left, right) =>
              left.side - right.side || left.tag.localeCompare(right.tag),
          );
        const rawMode = text(row.game_mode.name) ?? "";
        const isDuel =
          /duel/i.test(rawMode) ||
          row.battle_participants.some(
            (participant) =>
              Array.isArray(participant.raw_participant.rounds) &&
              participant.raw_participant.rounds.length > 0,
          );
        return {
          id: row.id,
          time: row.battle_time,
          type: row.battle_type,
          modeId: numeric(row.game_mode.id),
          mode: modeName(row.battle_type, rawMode),
          rawMode,
          participants,
          isDuel,
          rated: supportsScoring(row.battle_type, participants, isDuel),
        };
      })
      .sort((left, right) => Date.parse(right.time) - Date.parse(left.time));
    const times = playerRows.filter((row) => trackedTags.has(row.tag));
    return {
      scope,
      players,
      matches:
        scope === "all"
          ? matches
          : matches.filter((match) =>
              isDirectMatch(match, players[0].tag, players[1].tag),
            ),
      observations: observations
        .filter((row) => trackedTags.has(row.player_tag))
        .flatMap((row) => {
          const trophies = numeric(row.player_snapshots.profile.trophies);
          return trophies === null
            ? []
            : [{ tag: row.player_tag, time: row.observed_at, trophies }];
        }),
      collectionStarted: times.length
        ? times.map((row) => row.first_collected_at).sort()[0]
        : null,
      lastCollected: times.length
        ? (times
            .map((row) => row.last_collected_at)
            .sort()
            .at(-1) ?? null)
        : null,
    };
  },
);
