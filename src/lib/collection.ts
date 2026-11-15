import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { battleSchema, normalizePlayerTag, playerSchema, upcomingChestsSchema } from "./clash-royale/client";

export const collectionSchema = z.object({
  observed_at: z.iso.datetime(),
  player_tag: z.string(),
  profile: playerSchema,
  battles: z.array(battleSchema),
  upcoming_chests: upcomingChestsSchema.nullable(),
  upcoming_chests_error: z.string().nullable(),
});

export type PlayerCollection = z.infer<typeof collectionSchema>;

// Object property order is irrelevant to identity. Array order remains meaningful.
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function contentHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function prepareCollection(input: unknown) {
  const collection = collectionSchema.parse(input);
  const playerTag = normalizePlayerTag(collection.player_tag);
  if (collection.profile.tag !== playerTag) throw new Error("Collection profile tag does not match the tracked player.");

  const battles = collection.battles.map((battle) => {
    const sides = [battle.team, battle.opponent].sort((left, right) => {
      const leftTags = left.map((participant) => participant.tag).sort().join(",");
      const rightTags = right.map((participant) => participant.tag).sort().join(",");
      return leftTags < rightTags ? -1 : leftTags > rightTags ? 1 : 0;
    });
    if (!sides.flat().some((participant) => participant.tag === playerTag)) {
      throw new Error("Battle does not include the tracked player.");
    }
    const timestamp = battle.battleTime.replace(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/,
      "$1-$2-$3T$4:$5:$6.$7Z",
    );
    const battleTime = new Date(timestamp).toISOString();
    if (battleTime !== timestamp) throw new Error("Battle has an invalid calendar timestamp.");
    const scores = sides.map((side) => Math.max(...side.map((participant) => participant.crowns)));
    const participants = sides.flatMap((side, sideIndex) => side.map((participant) => {
      const otherScore = scores[1 - sideIndex];
      const score = scores[sideIndex];
      let result = "draw";
      if (score > otherScore) result = "win";
      if (score < otherScore) result = "loss";
      return {
        side: sideIndex, tag: participant.tag, name: participant.name,
        crowns: participant.crowns, result, cards: participant.cards, raw: participant,
      };
    }));
    return {
      id: contentHash({
        battle_time: battleTime,
        type: battle.type,
        game_mode_id: battle.gameMode.id,
        sides: sides.map((side) => side.map((participant) => participant.tag).sort()),
      }),
      battle_time: battleTime,
      battle_type: battle.type,
      game_mode: battle.gameMode,
      participants,
      payload_hash: contentHash(battle),
      raw: battle,
    };
  });

  return {
    player_tag: playerTag,
    observed_at: collection.observed_at,
    profile: collection.profile,
    upcoming_chests: collection.upcoming_chests,
    upcoming_chests_error: collection.upcoming_chests_error,
    snapshot_hash: contentHash({ profile: collection.profile, upcoming_chests: collection.upcoming_chests }),
    battles,
  };
}
