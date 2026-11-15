import { loadEnvConfig } from "@next/env";
import { trackedPlayers } from "../src/config/players";
import { ClashRoyaleApiError, ClashRoyaleClient } from "../src/lib/clash-royale/client";

async function main() {
  // Use the same .env.local loading conventions as the Next.js app.
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const client = new ClashRoyaleClient();
  let succeeded = 0;

  for (const player of trackedPlayers) {
    try {
      const profile = await client.getPlayer(player.tag);
      const battles = await client.getBattlelog(player.tag);
      console.log(`OK ${player.name} (${profile.tag}) — profile verified, ${battles.length} recent battles received.`);
      succeeded++;
    } catch (error) {
      const message = error instanceof ClashRoyaleApiError ? error.message : "Unexpected verification failure.";
      console.error(`FAILED ${player.name} (${player.tag}) — ${message}`);
    }
  }

  console.log(`Verified ${succeeded}/${trackedPlayers.length} players.`);
  if (succeeded !== trackedPlayers.length) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof ClashRoyaleApiError ? error.message : "API verification failed.");
  process.exitCode = 1;
});
