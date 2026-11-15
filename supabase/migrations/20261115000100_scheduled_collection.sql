create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create table if not exists tracker_private.collection_dispatches (
  request_id bigint primary key,
  requested_at timestamptz not null default now()
);
revoke all on tracker_private.collection_dispatches from public, anon, authenticated;

create or replace function tracker_private.dispatch_player_collection()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  job_secret text;
  request_id bigint;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets
    where name = 'rivalry_collector_url';
  select decrypted_secret into job_secret from vault.decrypted_secrets
    where name = 'rivalry_collector_secret';
  if project_url is null or job_secret is null then
    raise exception 'Collector Vault configuration is missing';
  end if;
  select net.http_post(
    url := project_url || '/functions/v1/collect-player-data',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-collection-secret', job_secret),
    body := jsonb_build_object('source', 'supabase-cron'),
    timeout_milliseconds := 120000
  ) into request_id;
  insert into tracker_private.collection_dispatches(request_id) values (request_id);
  return request_id;
end;
$$;
revoke all on function tracker_private.dispatch_player_collection() from public, anon, authenticated;

-- Deployment creates the cron job only after the authenticated function passes a live collection.
