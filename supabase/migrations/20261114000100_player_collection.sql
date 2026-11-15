-- All raw API fields are retained. Only the server's service_role can access data.
create table public.players (
  tag text primary key check (tag ~ '^#[0289PYLQGRJCUV]+$'),
  name text not null,
  latest_profile jsonb not null check (jsonb_typeof(latest_profile) = 'object'),
  latest_upcoming_chests jsonb,
  first_collected_at timestamptz not null,
  last_collected_at timestamptz not null
);

-- Identical responses share storage, while observations retain their timestamps.
create table public.player_snapshots (
  player_tag text not null references public.players(tag),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  upcoming_chests jsonb,
  primary key (player_tag, content_hash)
);

create table public.player_observations (
  player_tag text not null,
  observed_at timestamptz not null,
  snapshot_hash text not null,
  battlelog jsonb not null check (jsonb_typeof(battlelog) = 'array'),
  upcoming_chests_error text,
  primary key (player_tag, observed_at),
  foreign key (player_tag, snapshot_hash) references public.player_snapshots(player_tag, content_hash)
);

create table public.battles (
  id text primary key check (id ~ '^[0-9a-f]{64}$'),
  battle_time timestamptz not null,
  battle_type text not null,
  game_mode jsonb not null check (jsonb_typeof(game_mode) = 'object'),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null
);
create index battles_time_idx on public.battles (battle_time desc);

-- Preserve each perspective and any changed raw payload for the same match.
create table public.battle_observations (
  battle_id text not null references public.battles(id),
  observer_tag text not null references public.players(tag),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  raw_battle jsonb not null check (jsonb_typeof(raw_battle) = 'object'),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  primary key (battle_id, observer_tag, payload_hash)
);
create index battle_observations_player_idx on public.battle_observations (observer_tag, battle_id);

create table public.battle_participants (
  battle_id text not null references public.battles(id),
  side smallint not null check (side in (0, 1)),
  player_tag text not null,
  name text not null,
  crowns integer not null check (crowns >= 0),
  result text not null check (result in ('win', 'loss', 'draw')),
  cards jsonb not null check (jsonb_typeof(cards) = 'array'),
  raw_participant jsonb not null check (jsonb_typeof(raw_participant) = 'object'),
  primary key (battle_id, side, player_tag)
);
create index battle_participants_player_idx on public.battle_participants (player_tag, battle_id);

alter table public.players enable row level security;
alter table public.player_snapshots enable row level security;
alter table public.player_observations enable row level security;
alter table public.battles enable row level security;
alter table public.battle_observations enable row level security;
alter table public.battle_participants enable row level security;

revoke all on public.players, public.player_snapshots, public.player_observations,
  public.battles, public.battle_observations, public.battle_participants
  from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update on public.players, public.player_snapshots, public.player_observations,
  public.battles, public.battle_observations, public.battle_participants to service_role;

create function public.ingest_player_collection(p_collection jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tag text := p_collection->>'player_tag';
  v_observed_at timestamptz := (p_collection->>'observed_at')::timestamptz;
  v_snapshot_hash text := p_collection->>'snapshot_hash';
  v_profile jsonb := p_collection->'profile';
  v_chests jsonb := nullif(p_collection->'upcoming_chests', 'null'::jsonb);
  v_battle jsonb;
  v_participant jsonb;
  v_inserted integer;
  v_new_battles integer := 0;
begin
  if v_tag is null or v_observed_at is null or v_snapshot_hash is null
    or jsonb_typeof(v_profile) is distinct from 'object'
    or (v_profile->>'tag') is distinct from v_tag
    or jsonb_typeof(p_collection->'battles') is distinct from 'array' then
    raise exception 'Invalid player collection' using errcode = '22023';
  end if;

  -- This upsert locks the player row for the transaction and serializes its imports.
  insert into public.players (tag, name, latest_profile, latest_upcoming_chests, first_collected_at, last_collected_at)
  values (v_tag, v_profile->>'name', v_profile, v_chests, v_observed_at, v_observed_at)
  on conflict (tag) do update set
    name = case when excluded.last_collected_at >= players.last_collected_at then excluded.name else players.name end,
    latest_profile = case when excluded.last_collected_at >= players.last_collected_at then excluded.latest_profile else players.latest_profile end,
    latest_upcoming_chests = case when excluded.last_collected_at >= players.last_collected_at
      then coalesce(excluded.latest_upcoming_chests, players.latest_upcoming_chests) else players.latest_upcoming_chests end,
    first_collected_at = least(players.first_collected_at, excluded.first_collected_at),
    last_collected_at = greatest(players.last_collected_at, excluded.last_collected_at);

  insert into public.player_snapshots (player_tag, content_hash, profile, upcoming_chests)
  values (v_tag, v_snapshot_hash, v_profile, v_chests)
  on conflict do nothing;

  insert into public.player_observations (player_tag, observed_at, snapshot_hash, battlelog, upcoming_chests_error)
  values (v_tag, v_observed_at, v_snapshot_hash,
    (select coalesce(jsonb_agg(jsonb_build_object('id', b->>'id', 'payload_hash', b->>'payload_hash')), '[]'::jsonb)
      from jsonb_array_elements(p_collection->'battles') as b),
    p_collection->>'upcoming_chests_error')
  on conflict do nothing;

  -- Consistent lock order also protects concurrent imports of shared battles.
  for v_battle in select value from jsonb_array_elements(p_collection->'battles') order by value->>'id' loop
    insert into public.battles (id, battle_time, battle_type, game_mode, first_seen_at, last_seen_at)
    values (v_battle->>'id', (v_battle->>'battle_time')::timestamptz,
      v_battle->>'battle_type', v_battle->'game_mode', v_observed_at, v_observed_at)
    on conflict do nothing;
    get diagnostics v_inserted = row_count;
    v_new_battles := v_new_battles + v_inserted;

    update public.battles set first_seen_at = least(first_seen_at, v_observed_at),
      last_seen_at = greatest(last_seen_at, v_observed_at)
    where id = v_battle->>'id';

    insert into public.battle_observations (battle_id, observer_tag, payload_hash, raw_battle, first_seen_at, last_seen_at)
    values (v_battle->>'id', v_tag, v_battle->>'payload_hash', v_battle->'raw', v_observed_at, v_observed_at)
    on conflict (battle_id, observer_tag, payload_hash) do update set
      first_seen_at = least(battle_observations.first_seen_at, excluded.first_seen_at),
      last_seen_at = greatest(battle_observations.last_seen_at, excluded.last_seen_at);

    for v_participant in select value from jsonb_array_elements(v_battle->'participants') loop
      insert into public.battle_participants (battle_id, side, player_tag, name, crowns, result, cards, raw_participant)
      values (v_battle->>'id', (v_participant->>'side')::smallint, v_participant->>'tag',
        v_participant->>'name', (v_participant->>'crowns')::integer, v_participant->>'result',
        v_participant->'cards', v_participant->'raw')
      on conflict (battle_id, side, player_tag) do update set
        raw_participant = battle_participants.raw_participant || excluded.raw_participant;
    end loop;
  end loop;

  return jsonb_build_object('player_tag', v_tag,
    'battles_received', jsonb_array_length(p_collection->'battles'), 'battles_inserted', v_new_battles);
end;
$$;

revoke all on function public.ingest_player_collection(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_player_collection(jsonb) to service_role;
notify pgrst, 'reload schema';
