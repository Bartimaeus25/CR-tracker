# CR-tracker
Clash Royale tracker

#### Player Tags
Sprengmeister: #2CVGR2R8R
Bartimaues: #9Q2PQLG0L

## Local setup

Use Node.js 22 LTS (22.12 or newer) and npm. The repository contains a Next.js App Router foundation with strict TypeScript and Tailwind CSS. Development and builds use Next.js's supported webpack option because Turbopack failed to resolve Tailwind's native Windows dependency during setup.

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

If `.env.local` already exists, edit it directly. Set `CLASH_ROYALE_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY` locally. Use the Supabase project URL without `/rest/v1/` for `SUPABASE_URL`. The file is gitignored. GitHub Actions secrets are available only inside authorized workflows, so configure local values separately. Keep credentials out of chat, screenshots, logs, and commits.

Start the application with `npm run dev`, then visit http://localhost:3000. Use Node.js 22.12 or newer in the terminal running this command. All dashboard pages read the current stored Supabase data on the server.

## Rivalry dashboard

The dashboard uses the existing Supabase schema and collection pipeline. It displays real stored data, with loading, unavailable-data, missing-record, and empty states. The responsive layout includes a desktop sidebar and mobile bottom navigation. Card and badge artwork comes from the API's stored `api-assets.clashroyale.com` URLs. Geist and Barlow Condensed fonts are bundled locally.

The default scope across the overview, matches, decks, and player pages is **Head to head**, showing only matches where the tracked players faced each other. Choose **All opponents** for broader statistics or **All matches** in match history. The `?scope=all` query parameter opens the broader view directly.

| Page | Features |
| --- | --- |
| `/` | Player profiles, direct head-to-head score and streaks, overall comparison, rolling win-rate chart, recent matches, most-used decks, and upcoming chests |
| `/matches` | Unique match history with player, result, mode, and direct-match filters, plus pagination |
| `/matches/[id]` | Both sides, crown results, full decks, available trophy changes, tower HP, elixir leaked, and mode details |
| `/decks` | Deck grouping by unordered card IDs, use counts, wins/losses/draws, win rates, available average elixir, and repeated deck matchups |
| `/players` | Both profiles and their latest decks |
| `/players/[tag]` | A player's profile, statistics, opponent comparison, recent matches, decks, trophy observations, and full chest cycle |

Player routes use tags without the leading `#`, for example `/players/2CVGR2R8R`. The displayed name comes from the latest collected profile. Read-only dashboard access uses `players`, `battles`, `battle_participants`, `player_observations`, and `player_snapshots`. Responses are paginated beyond Supabase's per-request row limit. Database keys and raw profiles remain in server modules. Only curated game statistics and card/badge URLs are serialized to interactive components.

Direct head-to-head requires both tracked players on opposing sides. An encounter with the players on the same team contributes no direct head-to-head result. Global history lists each stored battle once. When both players participate, results follow the player shown first, and selecting a player changes that perspective.

Performance statistics score known standard 1v1 battle types with valid crown totals. Best-of-three duels use the winner of individual rounds, as described by [Supercell's duel rules](https://supercell.com/en/games/clashroyale/blog/release-notes/clash-royale-summer-update-2/). Aggregate crowns can be equal or favour the losing player, so they never determine a duel winner. A duel needs complete round data establishing two round wins to enter statistics. Match history retains one record per series, and details display every round and deck. Team matches and unrecognized event types remain visible as **Unscored**. In the initial data, `trail` event matches are excluded. Wins divided by all scored matches or duel series, including draws, gives the win rate. Crown averages and three-crown victories use individual games or duel rounds. Current and longest streaks cover recorded matches and series, and draws or unscored matches break winning streaks. Profile trophy totals represent the latest collected profile, and trophy charts use timestamped profile observations. An empty trophy-change state appears when all observed totals are equal.

Deck analytics require eight distinct card IDs. Each duel round contributes its own deck and game result, and the interface labels these counts as games/rounds. Card order and upgrade levels do not split a deck group. Draft, random, mirror, and preset event decks are excluded. Average elixir is unavailable when a card's cost is missing or variable. Deck matchups require at least three recorded games or duel rounds and show sample sizes. Pairings with fewer than ten games are labelled as early samples, with no counter claims.

All displayed timestamps use Europe/Berlin, including daylight-saving changes. Expand **About these statistics** for the stored battle window and calculation rules. **Refresh view** fetches the latest stored database state. GitHub Actions collects new API data hourly, and `npm run sync` can also collect data locally.

## First milestone

Configure the official Supercell API key to allow RoyaleAPI's proxy IP `45.79.218.79`, as documented in the [RoyaleAPI proxy guide](https://docs.royaleapi.com/proxy). Requests use `https://proxy.royaleapi.dev/v1` and a Bearer authorization header.

```powershell
npm run verify:api
```

The script loads `.env.local` using Next.js environment conventions. Existing process variables take precedence. It requests each configured player's profile and recent battlelog, validates the responses, and prints one concise result per player. Success requires both endpoints to succeed for both players and ends with `Verified 2/2 players.` A failure sets a nonzero exit code and still attempts the other player.

HTTP 403 usually requires checking the key and proxy IP allowlist. HTTP 404 requires checking the tag. HTTP 429 indicates rate limiting. Network errors, HTTP 429, and server errors receive up to three attempts with a ten-second timeout per request. Retry-After is respected up to a thirty-second wait. Longer Retry-After values return a failure so the command can be rerun later. Error output excludes response bodies and credentials.

Battlelogs contain a limited recent window. This verification command saves no battle history. An empty battlelog is valid. Live API verification requires a local key and internet access. Unit tests use mocked responses and cannot establish that the proxy accepts your key.

## Supabase setup and collection

In the Supabase dashboard, click **Connect**, choose **Session pooler**, and copy the PostgreSQL URI. Replace `[YOUR-PASSWORD]` with your database password and percent-encode reserved characters in the password. Save the URI as `DATABASE_URL` in `.env.local`. The session pooler supports IPv4, which is needed on development machines without IPv6 connectivity. See the [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).

```powershell
npm run db:migrate
npm run sync
```

`db:migrate` applies committed SQL migrations using a single TLS-protected PostgreSQL connection. It verifies the server certificate using Supabase's public CA certificate in `supabase/certs/prod-ca-2021.crt`, downloaded from [Supabase's certificate distribution](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt). It uses a transaction and a database lock to coordinate concurrent migration runs. Applied migration checksums are recorded in `tracker_private.schema_migrations`. Rerunning the command skips matching applied files. Add a new migration when the schema needs further changes. `DATABASE_URL` is required only for migrations. Collection uses the Supabase Data API and its server-side secret key.

`sync` fetches the full profile, recent battlelog, and upcoming chest sequence for each configured player. The full profile retains every returned field, including card collection and levels, current decks, achievements, badges, progression, rankings, battle statistics, and clan information when provided by the API. Each raw battle retains its complete response, including mode-specific fields, arena, decks, card variants, trophy changes, tower data, and participants. Upcoming chest responses are also stored in full. Available fields depend on the API response.

Each successful player capture is first written to the gitignored `.local/pending` directory. The command then imports pending files in timestamp order. A file is removed only after Supabase confirms the transaction. A failed import stays available for the next run. A crash after a successful database commit can safely replay the same file. A failed chest request is reported and recorded while the profile and battlelog are retained. Collection exits with a nonzero status if a fetch or import fails.

The data is stored in these tables.

| Table | Stored data |
| --- | --- |
| `players` | The two tracked players and their latest full profiles and available chest sequences |
| `player_snapshots` | Unique full profile and chest response combinations, deduplicated by content |
| `player_observations` | Each collection timestamp, snapshot reference, observed battle sequence, and chest request errors |
| `battles` | Unique match identity, time, type, and game mode |
| `battle_participants` | All participants, team side, crowns, result, full cards, and raw participant fields |
| `battle_observations` | Each tracked player's full view of a match, including changed raw responses |

Shared battles get the same identifier regardless of which player observed them or how teams are ordered. The identifier uses timestamp, type, game mode ID, and team rosters because the API supplies no battle identifier. Each player's perspective remains available. Repeated runs record observation times and reuse identical snapshot payloads. Each player's import is atomic. Older observations preserve history and cannot overwrite the latest player profile.

All six tables have Row Level Security enabled. Browser roles have no table access or permission to execute the ingestion function. The ingestion function uses the caller's permissions and is granted to `service_role`. Keep `SUPABASE_SECRET_KEY` server-side, as it has privileged database access.

Collection preserves only what the API currently returns. Battles that disappear from the recent window before a successful collection cannot be recovered through this API. Our API requests have returned up to 30 recent battlelog entries per player. A duel series can contain several games in a single entry. The available history window is controlled by the upstream API.

## Hourly collection with GitHub Actions

`.github/workflows/collect-player-data.yml` runs on `main` every hour at minute 17 UTC. The offset avoids the busiest start of the hour. It can also be started from GitHub **Actions → Collect player data → Run workflow**. Collection runs on GitHub even when the local dashboard and development computer are offline.

The workflow uses Node.js 22, `npm ci`, and the existing `npm run sync` command. It reads the three repository secrets `CLASH_ROYALE_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY`. Set `SUPABASE_URL` to the base project URL. Database migrations are managed separately with `DATABASE_URL` locally.

Normal collection makes six Clash Royale API requests per run, covering profiles, battlelogs, and upcoming chests for both players. Supabase imports remain idempotent. The workflow serializes collection jobs and retries a failed collection up to three times, with twenty seconds between attempts, in addition to the API client's bounded request retries.

After a failed run, remaining JSON captures are uploaded as `pending-player-data-<run-id>-<attempt>` artifacts and retained for thirty days. To recover them, download the artifact from that workflow run, extract its JSON files into the local gitignored `.local/pending` directory, and run `npm run sync`. Successful imports remove their pending files. Artifacts are recovery copies and are not restored automatically into later runners. They contain game data and are available to people with the repository's artifact access.

An hourly schedule is a practical collection interval, but complete history depends on fewer than a full battlelog window of new entries occurring between successful runs. GitHub schedules can be delayed or dropped during high load. Scheduled workflows run from the default branch. For public repositories, GitHub automatically disables schedules after sixty days without repository activity. Check and re-enable the workflow under Actions if that happens. See [GitHub's schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). Check the workflow's conclusion and logs when investigating gaps. Reload the dashboard with **Refresh view** after collection to see new stored data.

## File structure

```text
src/
  app/                     Dashboard routes, layout, loading/error states, and Tailwind styles
  components/dashboard/    Navigation, player comparisons, filters, charts, decks, and artwork
  config/players.ts        The two player tags above
  lib/clash-royale/client.ts  Server-only API client and response validation
  lib/collection.ts         Battle identity, normalization, and content hashing
  lib/supabase.ts           Transactional collection import through the Data API
  lib/dashboard/           Read-only data projection, types, formatting, and statistics
scripts/
  verify-clash-api.ts       Live profile and battlelog verification
  migrate.ts                PostgreSQL migration runner
  collect.ts                Capture both players and import pending data
supabase/migrations/        Versioned SQL schema and ingestion function
tests/
  clash-royale.test.ts      Mocked API client tests
  collection.test.ts        Identity, PostgreSQL ingestion, and access-control tests
  dashboard-stats.test.ts   Statistical integrity and read-pagination regression tests
.env.example               Variable names with empty values
```

The API client is protected by `server-only`. Import it from server code. The CLI and test commands enable the `react-server` condition so the same module can run outside Next.js. Keep privileged credentials server-side and avoid the `NEXT_PUBLIC_` prefix for API keys and Supabase secret keys.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

The lockfile pins installed dependencies. Use `npm ci` for reproducible installs. Next.js requires Node.js 20.9 or newer, and this project standardizes on Node.js 22.12 or newer. Database tests run the committed SQL against an isolated in-memory PostgreSQL instance using PGlite. They check duplicate imports, opposing battle perspectives, history ordering, transaction rollback, and browser-role permissions. See the [Next.js setup guide](https://nextjs.org/docs/app/getting-started/installation) and [Tailwind Next.js integration guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs).

## Later milestones

Vercel hosting follows later. Database credentials are needed only when applying migrations. The dashboard currently runs locally and has no sign-in. Its routes expose curated game statistics to visitors who can reach the server.
