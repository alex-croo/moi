-- This counter contains no journal content. It is available only to active
-- members without a vault, including when called directly through the Data API.
create or replace function public.reserve_ai_edit() returns boolean
language plpgsql security definer set search_path='' as $$
declare used integer; uid uuid:=auth.uid();
begin
  if uid is null then return false; end if;
  perform 1 from private.members where user_id=uid and active for update;
  if not found then return false; end if;
  if exists(select 1 from public.personal_vaults where owner_id=uid) then return false; end if;
  insert into private.ai_edit_usage(user_id,window_start,requests)
  values(uid,date_trunc('hour',now()),1)
  on conflict(user_id,window_start) do update
    set requests=private.ai_edit_usage.requests+1
    where private.ai_edit_usage.requests<20
  returning requests into used;
  delete from private.ai_edit_usage where window_start < now()-interval '2 days';
  return used is not null;
end $$;
revoke all on function public.reserve_ai_edit() from public,anon;
grant execute on function public.reserve_ai_edit() to authenticated;
