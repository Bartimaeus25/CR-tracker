# CR-tracker
Clash Royale tracker

#### Player Tags
Sprengmeister: #2CVGR2R8R
Bartimaues: #9Q2PQLG0L
Retrum: #8V22J2U02

## Local setup

Use Node.js 22 LTS (22.12 or newer) and npm. The repository contains a Next.js App Router foundation with strict TypeScript and Tailwind CSS. Development and builds use Next.js's supported webpack option because Turbopack failed to resolve Tailwind's native Windows dependency during setup.

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

If `.env.local` already exists, edit it directly. Set `CLASH_ROYALE_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY` locally. Use the Supabase project URL without `/rest/v1/` for `SUPABASE_URL`. The file is gitignored. GitHub Actions secrets are available only inside authorized workflows, so configure local values separately. Keep credentials out of chat, screenshots, logs, and commits.

Start the application with `npm run dev`, then visit http://localhost:3000. Use Node.js 22.12 or newer in the terminal running this command. All dashboard pages read the current stored Supabase data on the server.

## Rivalry dashboard

The default comparison is **Sprengmeister vs Retrum**. Use the player comparison selectors above the dashboard to choose any two of Sprengmeister, Retrum, and Bartimaues. The selected pair is remembered in this browser and applies across Overview, Stats, Matches, Decks and Players. Statistics and history are limited to the selected pair; all three players continue to be collected hourly and on manual refresh. Email summaries always use the default comparison.


The dashboard uses the existing Supabase schema and collection pipeline. It displays real stored data, with loading, unavailable-data, missing-record, and empty states. The responsive layout includes a desktop sidebar and mobile bottom navigation. Card and badge artwork comes from the API's stored `api-assets.clashroyale.com` URLs. Geist and Barlow Condensed fonts are bundled locally.

The overview is exclusively **Head to head**, including when an old `?scope=all` link is opened. The separate **Stats** tab shows all opponents, trophy development and Ranked progress. Matches, decks and player pages retain their scope controls; `?scope=all` opens their broader view directly. Overview and Stats each have a shared game-mode filter with **All modes** selected by default.

| Page | Features |
| --- | --- |
| `/` | Head-to-head score, calendar result bars, rivalry stories, side-by-side card/pair lab, recent rivalry matches and most-used rivalry decks |
| `/stats` | All-opponent performance, Ranked records, profile trophy and season-rating history, mode filtering and recent games |
| `/matches` | Unique match history with player, result, mode, and direct-match filters, plus pagination |
| `/matches/[id]` | Both sides, crown results, full decks, available trophy changes, tower HP, elixir leaked, and mode details |
| `/decks` | Deck grouping by unordered card IDs, use counts, wins/losses/draws, win rates, available average elixir, and repeated deck matchups |
| `/players` | Both profiles and their latest decks |
| `/players/[tag]` | A player's profile, statistics, opponent comparison, recent matches, decks, trophy observations, and full chest cycle |

Player routes use tags without the leading `#`, for example `/players/2CVGR2R8R`. The displayed name comes from the latest collected profile. Read-only dashboard access uses `players`, `battles`, `battle_participants`, `player_observations`, and `player_snapshots`. Responses are paginated beyond Supabase's per-request row limit. Database keys and raw profiles remain in server modules. Only curated game statistics and card/badge URLs are serialized to interactive components.

Direct head-to-head requires both tracked players on opposing sides. An encounter with the players on the same team contributes no direct head-to-head result. Global history lists each stored battle once. Match history names the winner with consistent player badges; crown-score order follows the displayed matchup.

Performance statistics score known standard 1v1 battle types with valid crown totals. Best-of-three duels use the winner of individual rounds, as described by [Supercell's duel rules](https://supercell.com/en/games/clashroyale/blog/release-notes/clash-royale-summer-update-2/). Aggregate crowns can be equal or favour the losing player, so they never determine a duel winner. A duel needs complete round data establishing two round wins to enter statistics. Match history retains one record per series, and details display every round and deck. Team matches and unrecognized event types remain visible as **Unscored**. In the initial data, `trail` event matches are excluded. Wins divided by all scored matches or duel series, including draws, gives the win rate. Crown averages and three-crown victories use individual games or duel rounds. Current and longest streaks cover recorded matches and series, and draws or unscored matches break winning streaks. Profile trophy totals represent the latest collected profile, and trophy charts use timestamped profile observations. An empty trophy-change state appears when all observed totals are equal.

Deck analytics require eight distinct card IDs. Each duel round contributes its own deck and game result, and the interface labels these counts as games/rounds. Card order and upgrade levels do not split a deck group. Draft, random, mirror, and preset event decks are excluded. Average elixir is unavailable when a card's cost is missing or variable. Deck matchups require at least three recorded games or duel rounds and show sample sizes. Pairings with fewer than ten games are labelled as early samples, with no counter claims.

All displayed timestamps use Europe/Berlin, including daylight-saving changes. Expand **About these statistics** for the stored battle window and calculation rules. **Refresh data** fetches fresh API data for all configured players, saves it to Supabase, and updates the current view. Supabase Cron also collects new API data hourly, and `npm run sync` can collect data locally.

The manual refresh runs through a same-origin Next.js Server Action with fixed server-side player configuration. It reuses the scheduled collector's capture, validation, API retries, and idempotent database import logic. The button is disabled while fetching and displays success, new-match counts, or partial/failure messages. Simultaneous manual requests in the same server process share one in-flight collection. Secrets stay server-side, and partial success refreshes the view with whichever players were saved. The current local dashboard has no sign-in, so visitors who can reach its server can invoke this fixed refresh operation.

## Player insights

Performance over time uses discrete stacked bars grouped by daily, weekly, monthly or yearly Berlin calendar periods. Weeks start Monday; dates around year boundaries and daylight saving use Berlin dates. The overview stacks each player's wins plus draws once per period. Stats shows two separate stacks per period, one per player, with wins, losses and draws against all opponents. Counts are matches/duel series, not individual duel rounds. Only periods with scored matches are shown; no line interpolates between results.

The overview's head-to-head card lab always compares both players in the same rows. It supports cards/pairs, name search, sample thresholds (default three, with one, five, ten or twenty available), and sorting by usage, highest/lowest win rate, win-rate difference, crown output or current unbeaten run. Usage divides appearances by each player's eligible games/rounds. Win-rate differences require both players to meet the threshold; rows can appear when only one meets it. A card never used by a player has no win rate. Under ten appearances is an early sample. Crown output is a whole-deck game outcome, never per-card damage. Levels/evolutions are grouped by card ID; invalid and preset decks are excluded. Deck and player pages retain individual advanced records.

Rivalry stories include a card's current unbeaten run (draws included), consecutive wins at its end, bounce-back wins after a recorded loss, two-round duel sweeps, conversion after winning round one, and highest observed mode win rates with at least three scored matches/series. Card runs count successive scored appearances of the card, including duel rounds; games without it do not count. Overall match winning streaks break on draws and unscored matches. These patterns describe the captured window, not a complete lifetime record or a causal effect of a card.

Stats uses already captured `currentPathOfLegendSeasonResult` profile fields for league and season rating, plus stored Ranked matches. Positive ratings are plotted when there are changes; zero/missing ratings and season resets must not be treated as ordinary match gains. Trophy and rating observation charts are independent of the match-mode filter. The overview chest-cycle section is removed; profile chest information and raw collection remain available.

Crown totals, clean wins, three-crown wins, and one-crown-margin wins count individual games/duel rounds. Comebacks count completed duel series won after losing round one. Decider records require a 1-1 split in the first two rounds. Mode tables retain unscored appearances, while win rates use scored matches/series. The captured remaining tower HP is insufficient to calculate total damage, so no damage metric is inferred.

Match history names the winner with a consistent player color and labels both participants. Result filters name each player explicitly. Duel winners are determined by rounds won, independently of aggregate crown scores.

## First milestone

Configure the official Supercell API key to allow RoyaleAPI's proxy IP `45.79.218.79`, as documented in the [RoyaleAPI proxy guide](https://docs.royaleapi.com/proxy). Requests use `https://proxy.royaleapi.dev/v1` and a Bearer authorization header.

```powershell
npm run verify:api
```

The script loads `.env.local` using Next.js environment conventions. Existing process variables take precedence. It requests each configured player's profile and recent battlelog, validates the responses, and prints one concise result per player. Success requires both endpoints to succeed for all configured players and ends with `Verified 2/2 players.` A failure sets a nonzero exit code and still attempts the other player.

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

## Hourly collection with Supabase

Supabase Cron job `collect-rivalry-players-hourly` runs `17 * * * *` (every hour at minute 17 UTC). It uses `pg_net` to call the `collect-player-data` Edge Function, which fetches both profiles, battlelogs, and chest sequences and saves them through the existing atomic import RPC. It runs while the development computer is offline. Normal collection makes nine Clash Royale API requests. API retries, schema validation, raw data preservation, battle identity and deduplication are shared with the local/manual collector. Edge imports retry up to three times per player. One player's failure does not prevent collection of the other.

The scheduler uses a dedicated random `COLLECTION_CRON_SECRET`, stored in Supabase Vault and Edge Function secrets. The function verifies it in `x-collection-secret` before doing work; `verify_jwt` is disabled because this is a custom service-to-service credential. Requests cannot specify player tags or API destinations. The privileged database key and Clash Royale key are available only to the Edge Function. `SUPABASE_ACCESS_TOKEN` is used locally for deployment and is never deployed to the function or stored in Vault.

To deploy or update this setup, configure the server values in `.env.local` and add a Supabase account management token as `SUPABASE_ACCESS_TOKEN` (function deployment and secrets write permissions). Then run:

```bash
npm run db:migrate
npm run collector:deploy
npm run collector:activate
npm run collector:status
```

`collector:deploy` bundles the shared collector into gitignored `.local/supabase-collector/index.ts`, generates a dedicated job secret if needed, configures Edge secrets, deploys, and verifies both authentication rejection and a real import of both players. Re-run it after changing shared collection code or credentials. `collector:activate` verifies a real import again, upserts the job's Vault values, and registers the hourly job. Applying the SQL migration alone does not activate a job. `collector:verify` tests the deployed function without changing the schedule. No Docker or Supabase CLI is required.

Supabase Dashboard **Cron** shows job dispatch history; **Edge Functions → collect-player-data → Logs** shows collection outcomes. `collector:status` reports the hourly job, recent HTTP status codes, cron dispatch runs, and both player timestamps. A successful cron entry proves the HTTP request was enqueued, not that collection completed: require HTTP 200 and advancing player timestamps. HTTP responses in `net._http_response` expire under the `pg_net` retention setting (normally six hours); private dispatch IDs remain in `tracker_private.collection_dispatches`. Missing older HTTP responses do not establish a failure. Optional external email alerts are configured separately below.

The automatic path was verified with a temporary one-minute Supabase Cron job on 15 November 2026 at 10:46 UTC / 11:46 Berlin: dispatch succeeded, the Edge response was HTTP 200, and both player collection timestamps advanced by 10:46:06 UTC. That temporary job was removed; only the hourly job remains. GitHub's schedule was then removed.

An hourly interval still depends on the upstream battlelog window and successful execution. Project availability, plan limits and Edge Function runtime limits apply. The Edge path retries imports in memory and does not keep the local CLI's disk outbox; after a terminal failure, use the manual refresh or retry before the upstream window moves on. Reload an open dashboard to see scheduled data, or use **Refresh data** for an immediate collection. See [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions).

## Collection failure email alerts

The Edge collector supports an external [Healthchecks.io](https://healthchecks.io/docs/) heartbeat. This monitor can alert even when the Supabase project itself is unavailable. A success heartbeat is sent only after the entire collection reports success and both players have been saved. Partial collections (including optional chest errors), exceptions and unauthorized requests do not renew the timer. Dashboard refresh and GitHub manual backup runs do not renew it either, so they cannot conceal a broken scheduled collector.

Create a Healthchecks.io account verified with `jan.portius@web.de` and enable its email integration. Add its project read-write API key as `HEALTHCHECKS_API_KEY` in `.env.local`. Then:

```bash
npm run alerts:setup
npm run collector:deploy -- --no-collection-test
npm run alerts:arm
npm run alerts:status
```

Setup creates or updates the dedicated check with **period 1 hour + grace 1 hour**, for an alert roughly two hours after the last successful heartbeat. The email integration is selected by matching the requested address in its name, or by using the project's single email integration. The API does not expose actual email addresses, so verify the recipient in the Healthchecks dashboard. No other integrations are assigned. Healthchecks sends a failure notification when the check transitions down and a recovery notification when it comes back up; optional repeated reminder emails are controlled in its account settings.

The private ping URL is saved locally and deployed as `HEALTHCHECKS_PING_URL`; the management API key stays local. Heartbeats contain no player data or credentials and use an empty POST with bounded retries. Monitoring transport failures are logged as `monitoring: failed` without changing a successful collection into a failed database import. A monitor/network outage can therefore also generate a stale-heartbeat email. Treat both the API key and ping URL as secrets.

The `--no-collection-test` deployment flag deliberately avoids invoking the collector or changing its schedule. `alerts:arm` sends one setup-only heartbeat for a new check, starting its initial two-hour timer without fetching any game data. After that, scheduled successful collections renew it. Re-running `arm` does not reset an already initialized check. No collection, deliberate outage or test email is triggered by `alerts:setup` or `alerts:status`. Email delivery and the full two-hour outage path must be verified separately; configuration alone does not prove inbox delivery.

Activated on 15 November 2026 using the verified account's email integration. The natural hourly run at 11:17 UTC / 12:17 Berlin returned HTTP 200, updated both players by 11:17:07 UTC, and renewed the external heartbeat at 11:17:08 UTC. No manual collection or schedule change was used for that verification. The monitor reports a one-hour period plus one-hour grace and an assigned email channel. No deliberate failure or test email was sent, so inbox delivery remains unverified.

## Daily and on-demand email summaries

The separate [Email Reports page](http://localhost:3000/reports) is linked in the sidebar and footer. The overview stays unchanged. It previews the last 24 hours and can send that summary to the server-side allowlist in `REPORT_RECIPIENTS` (comma-separated addresses, configured locally and in Edge secrets). Sending a report reads Supabase only; it does not collect game data or renew the collection heartbeat.

The daily report arrives at **07:00 Europe/Berlin**, covering the previous Berlin calendar day. Supabase Cron runs `send-rivalry-report-daily` at UTC 05:00 and 06:00; its private dispatch function invokes the email worker only when the Berlin hour is 07, handling summer/winter time without changing the schedule. Only one candidate sends on each date. The first scheduled daily report after setup is 16 November 2026 at 07:00 Berlin.

Reports contain current freshness for all configured players, the number of saved profile updates, full-period coverage (no observed gaps of at least two hours, a detected gap, or incomplete historical coverage), head-to-head wins/draws, and crowns. A currently fresh profile does not prove the whole day was healthy. Coverage uses saved profile observations, including manual collection; it describes data availability and is separate from Healthchecks' external scheduler monitoring.

The worker sends through `smtp.web.de:465` using TLS certificate verification and a WEB.DE app password in `REPORT_SMTP_PASSWORD`. SMTP authentication requires mailbox POP3/IMAP access to be enabled. `reports:deploy` checks unauthenticated rejection and SMTP connection/login without sending email or fetching game data. Then `reports:activate` repeats that verification and registers the daily job. The `--reports` deployment option never invokes game collection.

```bash
npm run db:migrate
npm run reports:deploy
npm run reports:activate
npm run reports:status
npm run reports:preview
```

Delivery claims are stored in `tracker_private.report_deliveries`. Daily reports have one claim per period; on-demand requests have a database-enforced 15-minute global cooldown. A daily period is not automatically retried after an uncertain SMTP outcome, to avoid duplicates. Report status is visible on the Reports page and via `reports:status`. Mail-server acceptance does not prove inbox delivery. The dashboard currently has no sign-in; recipients are fixed server-side and requests are rate-limited, so public deployment should add user authorization before exposing email actions broadly.

Healthchecks' own healthy-day digests are enabled separately in **Account → Email Reports → Daily**. Adding an Email integration gives an address failure/recovery notifications, not an account's periodic digest. For the two confirmed email integrations in this project, `npm run alerts:setup -- --include-second-email` attaches both to the failure check without resetting its heartbeat or triggering collection. The API exposes integration names, not underlying email addresses; confirm the recipients in the Healthchecks dashboard. The custom 07:00 report goes to both fixed recipients regardless of Healthchecks digest settings.

## GitHub Actions manual backup

`.github/workflows/collect-player-data.yml` has only `workflow_dispatch`. Start it from GitHub **Actions → Collect player data → Run workflow**. The GitHub scheduler investigation is retained in [docs/scheduler-investigation.md](docs/scheduler-investigation.md) as historical context.

The workflow uses Node.js 22, `npm ci`, and the existing `npm run sync` command. It reads the three repository secrets `CLASH_ROYALE_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY`. Set `SUPABASE_URL` to the base project URL. Database migrations are managed separately with `DATABASE_URL` locally.

Normal collection makes nine Clash Royale API requests per run, covering profiles, battlelogs, and upcoming chests for all configured players. Supabase imports remain idempotent. The workflow serializes collection jobs and retries a failed collection up to three times, with twenty seconds between attempts, in addition to the API client's bounded request retries.

After a failed run, remaining JSON captures are uploaded as `pending-player-data-<run-id>-<attempt>` artifacts and retained for thirty days. To recover them, download the artifact from that workflow run, extract its JSON files into the local gitignored `.local/pending` directory, and run `npm run sync`. Successful imports remove their pending files. Artifacts are recovery copies and are not restored automatically into later runners. They contain game data and are available to people with the repository's artifact access.

Check the workflow's conclusion and logs when investigating manual backup failures. The GitHub workflow does not schedule any automatic collection.

## File structure

```text
src/
  app/                     Dashboard routes, layout, loading/error states, and Tailwind styles
  components/dashboard/    Navigation, player comparisons, filters, charts, decks, and artwork
  config/players.ts        The configured player tags above
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
