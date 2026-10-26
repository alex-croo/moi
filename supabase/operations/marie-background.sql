-- Run as database operator after migration and deployment. No journal or credential in cron commands.
-- Provision vault secret tredmeal_marie_worker and matching coach_config.secret_hash first.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function learning_private.dispatch_coach() returns bigint
language plpgsql security definer set search_path='' as $$
declare credential text; issued_at text; signature text; request_id bigint;
begin
 if not exists(select 1 from learning_private.coach_jobs j
  join public.learning_profiles p on p.owner_id=j.owner_id and p.personalization
  join private.members m on m.user_id=j.owner_id and m.active
  where j.available_at<=now() and (j.leased_until is null or j.leased_until<now())
  and not exists(select 1 from public.personal_vaults v where v.owner_id=j.owner_id)) then return null; end if;
 select decrypted_secret into credential from vault.decrypted_secrets where name='tredmeal_marie_worker';
 if length(coalesce(credential,''))<40 then raise exception 'Worker not configured';end if;
 -- Supabase owns pg_net queue permissions. A short-lived signature can only trigger work,
 -- and cannot be used to read journals through the dedicated database protocol.
 issued_at:=floor(extract(epoch from clock_timestamp()))::bigint::text;
 signature:=encode(extensions.hmac('marie-tick:'||issued_at,credential,'sha256'),'hex');
 select net.http_post(
  url:='https://tredmeal.com/api/internal/marie',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Marie '||signature,'x-marie-time',issued_at),
  body:='{}'::jsonb,timeout_milliseconds:=120000) into request_id;
 return request_id;
end $$;
revoke all on function learning_private.dispatch_coach() from public,anon,authenticated;
select cron.schedule('tredmeal-marie-daily-preparation','* * * * *','select learning_private.dispatch_coach()');
-- Retain only seven days of this job's technical history; user data is stored elsewhere.
select cron.schedule('tredmeal-marie-job-history','17 4 * * *',
 $$delete from cron.job_run_details where jobid in (select jobid from cron.job where jobname like 'tredmeal-marie-%') and end_time<now()-interval '7 days'$$);
