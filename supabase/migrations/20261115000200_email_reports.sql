create table tracker_private.report_deliveries (
  id uuid primary key default gen_random_uuid(),
  report_key text not null unique,
  kind text not null check (kind in ('daily', 'manual')),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  accepted_count integer not null default 0
);
revoke all on tracker_private.report_deliveries from public, anon, authenticated;

create function public.claim_rivalry_report(p_kind text, p_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_kind not in ('daily','manual') or length(p_key) > 160 then raise exception 'Invalid report request'; end if;
  perform pg_advisory_xact_lock(hashtext('rivalry-email-report'));
  if exists(select 1 from tracker_private.report_deliveries where report_key=p_key) then
    return jsonb_build_object('claimed',false,'reason','already_attempted');
  end if;
  if p_kind='manual' and exists(select 1 from tracker_private.report_deliveries
      where kind='manual' and created_at > now()-interval '15 minutes') then
    return jsonb_build_object('claimed',false,'reason','cooldown');
  end if;
  insert into tracker_private.report_deliveries(report_key,kind) values(p_key,p_kind) returning id into v_id;
  return jsonb_build_object('claimed',true,'id',v_id);
end;
$$;
create function public.finish_rivalry_report(p_id uuid, p_accepted integer, p_ok boolean)
returns void language sql security definer set search_path = '' as $$
  update tracker_private.report_deliveries
    set status=case when p_ok then 'sent' else 'failed' end, finished_at=now(), accepted_count=greatest(0,p_accepted)
    where id=p_id and status='sending';
$$;
revoke all on function public.claim_rivalry_report(text,text) from public,anon,authenticated;
revoke all on function public.finish_rivalry_report(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.claim_rivalry_report(text,text) to service_role;
grant execute on function public.finish_rivalry_report(uuid,integer,boolean) to service_role;

create function tracker_private.dispatch_daily_report()
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text; v_id bigint;
begin
  -- Two UTC candidates cover daylight saving. Only 07:00 Berlin actually sends.
  if extract(hour from now() at time zone 'Europe/Berlin') <> 7 then return null; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name='rivalry_collector_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='rivalry_collector_secret';
  if v_url is null or v_secret is null then raise exception 'Report Vault configuration missing'; end if;
  select net.http_post(url:=v_url||'/functions/v1/send-rivalry-report',
    headers:=jsonb_build_object('Content-Type','application/json','x-collection-secret',v_secret),
    body:='{"kind":"daily"}'::jsonb, timeout_milliseconds:=120000) into v_id;
  return v_id;
end;
$$;
revoke all on function tracker_private.dispatch_daily_report() from public,anon,authenticated;
-- The deployment command activates the daily job after SMTP verification.
notify pgrst, 'reload schema';
