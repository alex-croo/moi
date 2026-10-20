-- Standard mode remains owner-only. No admin content endpoint is introduced.
create table public.standard_workspaces (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 revision integer not null check(revision>0),
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<3000000),
 updated_at timestamptz not null default now()
);
alter table public.standard_workspaces enable row level security;
revoke all on public.standard_workspaces from public,anon,authenticated;
grant select on public.standard_workspaces to authenticated;
create policy standard_owner on public.standard_workspaces for select to authenticated using(public.current_user_allowed() and owner_id=auth.uid() and not exists(select 1 from public.personal_vaults where owner_id=auth.uid()));
create function public.save_standard_workspace(expected_revision integer, personal jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); actual integer; t text;
begin
 perform 1 from private.members where user_id=uid and active for update;
 if not found then raise exception 'Forbidden' using errcode='42501'; end if;
 if exists(select 1 from public.personal_vaults where owner_id=uid) then raise exception 'Protection enabled' using errcode='40001'; end if;
 select revision into actual from public.standard_workspaces where owner_id=uid for update;
 if coalesce(actual,0)<>expected_revision then raise exception 'Workspace changed' using errcode='40001'; end if;
 if not coalesce(personal ?& array['journal','weights','plans','slots','pantry','preferences','documents','groceryChecks','program'],false) then raise exception 'Invalid workspace'; end if;
 insert into public.standard_workspaces(owner_id,revision,data) values(uid,expected_revision+1,personal)
 on conflict(owner_id) do update set revision=excluded.revision,data=excluded.data,updated_at=now();
 -- The complete legacy snapshot was included in the first standard save.
 if expected_revision=0 then
  foreach t in array array['grocery_checks','pantry_items','meal_slots','unit_preferences','menu_plans','weight_entries','journal_entries','document_links'] loop
   execute format('delete from public.%I where owner_id=$1',t) using uid;
  end loop;
 end if;
 return expected_revision+1;
end $$;
revoke all on function public.save_standard_workspace(integer,jsonb) from public,anon;
grant execute on function public.save_standard_workspace(integer,jsonb) to authenticated;
create or replace function public.save_personal_vault(expected_revision integer, sealed jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare current_revision integer; uid uuid:=auth.uid(); next_revision integer; t text;
begin
 if uid is null or not public.current_user_allowed() then raise exception 'Forbidden' using errcode='42501'; end if;
 -- Member row also serializes first creation and concurrent account revocation.
 perform 1 from private.members where user_id=uid and active for update;
 if not found then raise exception 'Forbidden' using errcode='42501'; end if;
 if expected_revision=0 and exists(select 1 from public.standard_workspaces where owner_id=uid) then raise exception 'Activation required' using errcode='40001'; end if;
 select revision into current_revision from public.personal_vaults where owner_id=uid for update;
 if coalesce(current_revision,0)<>expected_revision then raise exception 'Vault changed' using errcode='40001'; end if;
 next_revision:=expected_revision+1;
 if not coalesce(sealed ?& array['version','ownerId','revision','iterations','salt','password','recovery','payload'],false) then raise exception 'Invalid envelope'; end if;
 if sealed->>'version'<>'1' or (sealed->>'revision')::integer<>next_revision or sealed->>'ownerId'<>uid::text
    or jsonb_typeof(sealed->'payload')<>'object' or (jsonb_typeof(sealed->'password')<>'object' and not (sealed->'password'='null'::jsonb and jsonb_typeof(sealed->'passkeys')='array' and jsonb_array_length(sealed->'passkeys')>0))
    or jsonb_typeof(sealed->'recovery')<>'object' or (sealed->>'iterations')::integer<>600000
    or length(coalesce(sealed->'payload'->>'ciphertext',''))<24 then raise exception 'Invalid envelope'; end if;
 insert into public.personal_vaults(owner_id,revision,envelope) values(uid,next_revision,sealed)
 on conflict(owner_id) do update set revision=excluded.revision,envelope=excluded.envelope,updated_at=now();
 if expected_revision=0 then
  foreach t in array array['grocery_checks','pantry_items','meal_slots','unit_preferences','menu_plans','weight_entries','journal_entries','document_links'] loop
   execute format('delete from public.%I where owner_id=$1',t) using uid;
  end loop;
 end if;
 return next_revision;
end $$;

-- Lock the same membership row as both save paths: stale tabs cannot reintroduce plaintext.
create function public.activate_personal_vault(expected_standard_revision integer, sealed jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); actual integer; result integer;
begin
 perform 1 from private.members where user_id=uid and active for update;
 if not found then raise exception 'Forbidden' using errcode='42501'; end if;
 if exists(select 1 from public.personal_vaults where owner_id=uid) then raise exception 'Already protected' using errcode='40001'; end if;
 select revision into actual from public.standard_workspaces where owner_id=uid for update;
 if coalesce(actual,0)<>expected_standard_revision then raise exception 'Workspace changed' using errcode='40001'; end if;
 delete from public.standard_workspaces where owner_id=uid;
 result:=public.save_personal_vault(0,sealed);
 return result;
end $$;
revoke all on function public.activate_personal_vault(integer,jsonb) from public,anon;
grant execute on function public.activate_personal_vault(integer,jsonb) to authenticated;
create or replace function public.manage_platform(action text, target text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.current_user_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
 if action='invite' then
  if length(trim(target))>254 or trim(target) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
  if (select count(*) from private.platform_invitations where invited_by=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'Invitation limit'; end if;
  if exists(select 1 from private.members m join auth.users u on u.id=m.user_id where lower(u.email)=lower(trim(target))) then raise exception 'Already registered'; end if;
  update private.platform_invitations set revoked_at=now() where email=lower(trim(target)) and accepted_at is null and revoked_at is null;
  insert into private.platform_invitations(email,invited_by) values(lower(trim(target)),auth.uid());
 elsif action='cancel' then update private.platform_invitations set revoked_at=now() where id=target::uuid and accepted_at is null;
 elsif action in ('suspend','restore') then
  update private.members set active=(action='restore') where user_id=target::uuid and role<>'admin';
 elsif action<>'list' then raise exception 'Invalid action'; end if;
 select jsonb_build_object('members',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'email',u.email,'role',m.role,'active',m.active,'protected',exists(select 1 from public.personal_vaults v where v.owner_id=m.user_id))) from private.members m join auth.users u on u.id=m.user_id),'[]'),
 'invitations',coalesce((select jsonb_agg(to_jsonb(i)-'invited_by' order by created_at desc) from private.platform_invitations i),'[]')) into result;
 return result;
end $$;
create or replace function public.circle_action(action text, cid uuid default null, target text default '', label text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); invitation public.circle_invitations; result uuid; address text;
begin
 if not public.current_user_allowed() then raise exception 'Forbidden' using errcode='42501'; end if;
 if action='create' then
  if (select count(*) from public.circles where created_by=uid)>=10 then raise exception 'Circle limit'; end if;
  insert into public.circles(name,created_by) values(trim(target),uid) returning id into result;
  insert into public.circle_members values(result,uid,trim(label)); return result;
 elsif action='accept' then
  select * into invitation from public.circle_invitations where id=cid and expires_at>now() for update;
  if invitation.id is null or not public.is_my_email(invitation.email) then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  perform 1 from public.circles where id=invitation.circle_id for update;
  if (select count(*) from public.circle_members where circle_id=invitation.circle_id)>=20 then raise exception 'Circle full'; end if;
  insert into public.circle_members values(invitation.circle_id,uid,trim(label)) on conflict do nothing;
  delete from public.circle_invitations where id=invitation.id; return invitation.circle_id;
 elsif action='decline' then
  delete from public.circle_invitations where id=cid and public.is_my_email(email); return cid;
 end if;
 -- Serialize removal/leave and posting to avoid posting after membership ends.
 perform 1 from public.circles where id=cid for update;
 if not public.in_circle(cid) then raise exception 'Forbidden' using errcode='42501'; end if;
 if action='post' then
  if (select count(*) from public.circle_events where user_id=uid and created_at>now()-interval '1 hour')>=30 then raise exception 'Post limit'; end if;
  insert into public.circle_events(circle_id,user_id,kind) values(cid,uid,target);
 elsif action='leave' then
  if public.owns_circle(cid) then raise exception 'Owner must close circle'; end if;
  delete from public.circle_events where circle_id=cid and user_id=uid;
  delete from public.circle_members where circle_id=cid and user_id=uid;
 elsif action='alias' then update public.circle_members set alias=trim(label) where circle_id=cid and user_id=uid;
 else
  if not public.owns_circle(cid) then raise exception 'Forbidden' using errcode='42501'; end if;
  if action='invite' then
   address:=lower(trim(target));
   if not exists(select 1 from private.members m join auth.users u on u.id=m.user_id where m.active and lower(u.email)=address) then raise exception 'Invite an active platform member'; end if;
   if (select count(*) from public.circle_invitations where circle_id=cid)>=20 then raise exception 'Invitation limit'; end if;
   insert into public.circle_invitations(circle_id,email,circle_name,inviter_alias) values(cid,address,(select name from public.circles where id=cid),(select alias from public.circle_members where circle_id=cid and user_id=uid)) on conflict(circle_id,email) do update set expires_at=now()+interval '7 days';
  elsif action='cancel' then delete from public.circle_invitations where circle_id=cid and id=target::uuid;
  elsif action='remove' then
   if target=uid::text then raise exception 'Owner cannot remove self'; end if;
   delete from public.circle_events where circle_id=cid and user_id=target::uuid;
   delete from public.circle_members where circle_id=cid and user_id=target::uuid;
  elsif action='close' then delete from public.circles where id=cid;
  else raise exception 'Invalid action'; end if;
 end if;
 return cid;
end $$;
