-- Per-login activity, measured by the server. Token refresh and background reads
-- do not extend it. No journal content or browser-provided timestamps are stored.
create table private.app_session_activity (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_active_at timestamptz not null
);
alter table private.app_session_activity enable row level security;
revoke all on private.app_session_activity from public, anon, authenticated;
create index app_session_activity_owner on private.app_session_activity(user_id);

create function private.app_session_status(touch boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); sid uuid; started timestamptz; last_active timestamptz;
begin
  if uid is null or not public.current_user_allowed() then return jsonb_build_object('active', false); end if;
  begin sid := nullif(auth.jwt()->>'session_id', '')::uuid;
  exception when invalid_text_representation then return jsonb_build_object('active', false); end;
  if sid is null then return jsonb_build_object('active', false); end if;
  select created_at into started from auth.sessions
    where id = sid and user_id = uid and (not_after is null or not_after > now());
  if not found then return jsonb_build_object('active', false); end if;
  -- Bootstrap from the actual sign-in, never from a rotating token's iat.
  insert into private.app_session_activity(session_id,user_id,last_active_at)
    values(sid,uid,started) on conflict (session_id) do nothing;
  select last_active_at into last_active from private.app_session_activity
    where session_id=sid and user_id=uid;
  if last_active is null or last_active + interval '30 days' <= now() then
    return jsonb_build_object('active', false);
  end if;
  if touch then
    update private.app_session_activity set last_active_at=now()
      where session_id=sid and user_id=uid and last_active_at + interval '30 days' > now()
      returning last_active_at into last_active;
    if not found then return jsonb_build_object('active', false); end if;
  end if;
  return jsonb_build_object('active',true,'expiresAt',last_active + interval '30 days');
end;
$$;
revoke all on function private.app_session_status(boolean) from public, anon;
grant execute on function private.app_session_status(boolean) to authenticated;

-- Exposed wrapper has no elevated privileges. The private function derives
-- identity and session exclusively from the authenticated JWT.
create function public.app_session_status(touch boolean default false) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.app_session_status(touch);
$$;
revoke all on function public.app_session_status(boolean) from public, anon;
grant execute on function public.app_session_status(boolean) to authenticated;
