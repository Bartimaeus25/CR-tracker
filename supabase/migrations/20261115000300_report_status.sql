create function public.get_rivalry_report_status()
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'enabled', exists(select 1 from cron.job where jobname='send-rivalry-report-daily' and active),
    'latest', (select jsonb_build_object('kind',kind,'status',status,'created_at',created_at,'accepted_count',accepted_count)
      from tracker_private.report_deliveries order by created_at desc limit 1)
  );
$$;
revoke all on function public.get_rivalry_report_status() from public,anon,authenticated;
grant execute on function public.get_rivalry_report_status() to service_role;
notify pgrst, 'reload schema';
