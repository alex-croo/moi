-- Durable, owner-scoped memory and precomputed daily pages. No journal text is logged.
alter table public.learning_profiles add column locale text not null default 'fr' check(locale in ('fr','en','es','pt-BR'));
alter table public.learning_days add column opened_at timestamptz;
alter table public.learning_memories add column source_hash text;
alter table public.learning_memories add column excerpt text;
alter table public.learning_memories add column topic text;
alter table public.learning_memories add column kind text;
alter table public.learning_memories add column experiment_date date;
alter table public.learning_memories add column origin text not null default 'legacy';
alter table public.learning_memories add column active boolean not null default true;
alter table public.learning_memories add column last_used date;

create table learning_private.coach_config (id boolean primary key default true check(id), secret_hash text not null);
create table learning_private.coach_jobs (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 available_at timestamptz not null default now(), lease uuid, leased_until timestamptz,
 attempts integer not null default 0, last_success timestamptz, last_error text
);
create table learning_private.coach_index (
 owner_id uuid not null references auth.users(id) on delete cascade, date date not null,
 source_hash text not null, indexed_at timestamptz not null default now(), primary key(owner_id,date)
);
create table learning_private.coach_exclusions (
 owner_id uuid not null references auth.users(id) on delete cascade, date date not null,
 primary key(owner_id,date)
);
create table learning_private.coach_pages (
 owner_id uuid not null references auth.users(id) on delete cascade, date date not null,
 document_id uuid not null references public.learning_documents(id), snapshot jsonb not null,
 fingerprint text not null, locale text not null, adaptation jsonb not null,
 created_at timestamptz not null default now(), primary key(owner_id,date)
);
do $$declare t text;begin
 foreach t in array array['coach_config','coach_jobs','coach_index','coach_exclusions','coach_pages'] loop
  execute format('alter table learning_private.%I enable row level security',t);
  execute format('revoke all on learning_private.%I from public,anon,authenticated',t);
 end loop;
end $$;

-- Only the person's writing is indexed; AI questions and lesson prose are never autobiographical sources.
create function learning_private.coach_sources(uid uuid) returns table(date date,text text,hash text)
language sql stable set search_path='' as $$
 with fragments as (
  select (j->>'date')::date d, coalesce(j->>'text','') body from public.standard_workspaces w
  cross join lateral jsonb_array_elements(coalesce(w.data->'journal','[]')) j where w.owner_id=uid
  union all
  select d.date,coalesce(n.value->>'text','') from public.learning_days d cross join lateral jsonb_each(d.notes) n where d.owner_id=uid
 ), joined as (select d,string_agg(body,E'\n\n' order by body) body from fragments where length(trim(body))>0 group by d)
 select d,body,md5(body) from joined where not exists(select 1 from learning_private.coach_exclusions e where e.owner_id=uid and e.date=d)
$$;
create function learning_private.coach_fingerprint(uid uuid) returns text
language sql stable set search_path='' as $$
 select md5(jsonb_build_object(
 'sources',(select jsonb_agg(jsonb_build_array(date,hash) order by date) from learning_private.coach_sources(uid)),
 'memories',(select jsonb_agg(jsonb_build_array(id,text,active,last_used) order by id) from public.learning_memories where owner_id=uid),
 'completed',(select jsonb_agg(jsonb_build_array(document_id,completed_on) order by document_id) from public.learning_completions where owner_id=uid),
 'documents',(select jsonb_agg(jsonb_build_array(id,published_revision,status) order by position) from public.learning_documents),
 'exclusions',(select jsonb_agg(date order by date) from learning_private.coach_exclusions where owner_id=uid),
 'locale',(select locale from public.learning_profiles where owner_id=uid))::text)
$$;
create function learning_private.coach_target(uid uuid,target date) returns jsonb
language plpgsql stable set search_path='' as $$
declare d public.learning_days; doc public.learning_documents; m public.learning_modules; today date;
begin
 select (now() at time zone time_zone)::date into today from public.learning_profiles where owner_id=uid;
 if target<today or target>today+1 then return null;end if;
 select * into d from public.learning_days where owner_id=uid and date=target;
 if found then return jsonb_build_object('date',target,'document_id',d.document_id,'snapshot',d.snapshot,'quiet',d.quiet,'opened',d.opened_at is not null);end if;
 select * into d from public.learning_days x where owner_id=uid and date<=today and not exists(select 1 from public.learning_completions c where c.owner_id=uid and c.document_id=x.document_id) order by date desc limit 1;
 if found then return jsonb_build_object('date',target,'document_id',d.document_id,'snapshot',d.snapshot,'quiet',false,'opened',false);end if;
 if target=today and exists(select 1 from public.learning_completions where owner_id=uid and completed_on=today) then return null;end if;
 select * into doc from public.learning_documents x where status<>'archived' and not exists(select 1 from public.learning_completions c where c.owner_id=uid and c.document_id=x.id) order by position limit 1;
 if doc.published is null then return null;end if;
 select * into m from public.learning_modules where id=doc.module_id;
 return jsonb_build_object('date',target,'document_id',doc.id,'snapshot',doc.published||jsonb_build_object('moduleTitle',m.title,'version',doc.published_revision),'quiet',false,'opened',false);
end $$;
create function learning_private.enqueue_coach(uid uuid,delay_seconds integer default 90) returns void
language sql security definer set search_path='' as $$
 insert into learning_private.coach_jobs(owner_id,available_at)
 select uid,now()+make_interval(secs=>delay_seconds) where exists(select 1 from public.learning_profiles where owner_id=uid and personalization)
 on conflict(owner_id) do update set available_at=least(learning_private.coach_jobs.available_at,excluded.available_at)
$$;
create function learning_private.coach_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='standard_workspaces' then
  if tg_op='UPDATE' and new.data->'journal' is not distinct from old.data->'journal' then return new;end if;
 elsif tg_table_name='learning_days' then
  if tg_op='UPDATE' and new.notes=old.notes and new.quiet=old.quiet then return new;end if;
 end if;
 perform learning_private.enqueue_coach(new.owner_id,90);return new;
end $$;
create trigger coach_journal_changed after insert or update on public.standard_workspaces for each row execute function learning_private.coach_changed();
create trigger coach_notes_changed after insert or update on public.learning_days for each row execute function learning_private.coach_changed();
create trigger coach_progress_changed after insert on public.learning_completions for each row execute function learning_private.coach_changed();
create trigger coach_preferences_changed after insert or update on public.learning_profiles for each row execute function learning_private.coach_changed();

-- Keep existing progression, note revision and editorial controls. Future pages stay in the private cache.
alter function learning_private.program_action(text,jsonb) rename to program_action_v3;
create function learning_private.program_action(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb; target date; today date; p learning_private.coach_pages; dates date[]; d date;
begin
 perform 1 from private.members where user_id=uid and active for update;
 if uid is null or not found or not public.current_user_allowed() then raise exception 'Forbidden' using errcode='42501';end if;
 if payload->>'locale' in ('fr','en','es','pt-BR') then update public.learning_profiles set locale=payload->>'locale' where owner_id=uid and locale<>payload->>'locale';end if;
 select (now() at time zone time_zone)::date into today from public.learning_profiles where owner_id=uid;
 target:=coalesce((payload->>'date')::date,today);
 if action='memory' and payload->>'operation' in ('forget','forget_all','confirm') then
  if payload->>'operation'='forget_all' then
   select array_agg(date) into dates from learning_private.coach_sources(uid);
  else select array[source_date] into dates from public.learning_memories where owner_id=uid and id=(payload->>'id')::uuid;end if;
  foreach d in array coalesce(dates,array[]::date[]) loop
   -- A forgotten/corrected source is not silently re-extracted from the old journal.
   insert into learning_private.coach_exclusions values(uid,d) on conflict do nothing;
   delete from public.learning_memories where owner_id=uid and source_date=d and (payload->>'operation'<>'confirm' or id<>(payload->>'id')::uuid);
  end loop;
  if payload->>'operation'='confirm' then update public.learning_memories set origin='manual',active=true,source_hash=null,excerpt=null where owner_id=uid and id=(payload->>'id')::uuid;end if;
  delete from learning_private.coach_pages where owner_id=uid;
  -- Remove derived references immediately; retain every user note and completed lesson.
  update public.learning_days set adaptation=null where owner_id=uid and adaptation->>'version'='4';
  perform learning_private.enqueue_coach(uid,0);
 elsif action='preferences' and coalesce((payload->>'enabled')::boolean,false)=false then
  delete from learning_private.coach_pages where owner_id=uid;
  delete from learning_private.coach_jobs where owner_id=uid;
 elsif action='coach_refresh' then
  if target<>today then raise exception 'Today only';end if;
  if not exists(select 1 from public.learning_profiles where owner_id=uid and personalization) or exists(select 1 from public.personal_vaults where owner_id=uid) then raise exception 'Personalization disabled' using errcode='42501';end if;
  if exists(select 1 from public.learning_days where owner_id=uid and date=target and quiet) then raise exception 'Quiet day';end if;
  if (select count(*) from learning_private.ai_requests where owner_id=uid and date=today)>=4 or exists(select 1 from learning_private.ai_requests where owner_id=uid and created_at>now()-interval '30 seconds') then raise exception 'Rate limit' using errcode='53300';end if;
  insert into learning_private.ai_requests(owner_id,date,kind,finished) values(uid,target,'followup',true);
  delete from learning_private.coach_pages where owner_id=uid and date=target;
  update public.learning_days set opened_at=null,adaptation=null where owner_id=uid and date=target;
  perform learning_private.enqueue_coach(uid,0);
  return learning_private.program_action_v3('state',jsonb_build_object('date',target))||jsonb_build_object('preparing',true);
 end if;
 result:=learning_private.program_action_v3(action,payload);
 if action in ('state','ensure','memory') then
  result:=jsonb_set(result,'{memories}',coalesce((select jsonb_agg(to_jsonb(m)-'owner_id' order by source_date desc) from public.learning_memories m where owner_id=uid and active and status='confirmed'),'[]'));
 end if;
 if action='ensure' then
  today:=(result->>'today')::date;target:=coalesce((payload->>'date')::date,today);
  if target=today and coalesce((result->>'personalization')::boolean,false) and not coalesce((result->>'encrypted')::boolean,false) then
   select * into p from learning_private.coach_pages where owner_id=uid and date=target;
   if p.document_id is not null and p.fingerprint=learning_private.coach_fingerprint(uid) then
    update public.learning_days set adaptation=p.adaptation,revision=revision+1
     where owner_id=uid and date=target and not quiet and opened_at is null
      and document_id=p.document_id and snapshot=p.snapshot;
   end if;
   update public.learning_memories set last_used=target where owner_id=uid and id in (
    select jsonb_array_elements_text(coalesce(d.adaptation->'usedMemoryIds','[]'))::uuid from public.learning_days d where d.owner_id=uid and d.date=target and d.opened_at is null and d.adaptation->>'version'='4');
   update public.learning_days set opened_at=coalesce(opened_at,now()) where owner_id=uid and date=target;
   perform learning_private.enqueue_coach(uid,0);
   result:=learning_private.program_action_v3('state',jsonb_build_object('date',target));
   result:=jsonb_set(result,'{memories}',coalesce((select jsonb_agg(to_jsonb(m)-'owner_id' order by source_date desc) from public.learning_memories m where owner_id=uid and active and status='confirmed'),'[]'));
  end if;
 end if;
 return result;
end $$;
revoke all on function learning_private.program_action(text,jsonb) from public,anon;
grant execute on function learning_private.program_action(text,jsonb) to authenticated;
-- Rebind the public entry point (SQL functions can retain the old OID).
create or replace function public.learning_action(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select learning_private.program_action(action,payload)$$;

-- A dedicated, revocable worker credential grants only this protocol, not database-wide service access.
create function public.learning_worker(worker_key text,action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid; token uuid; job learning_private.coach_jobs; today date; src record; m jsonb; old_id text;
 target jsonb; p jsonb; result jsonb; fp text;
begin
 if length(coalesce(worker_key,''))<40 or not exists(select 1 from learning_private.coach_config where secret_hash=encode(sha256(convert_to(worker_key,'UTF8')),'hex')) then raise exception 'Forbidden' using errcode='42501';end if;
 if octet_length(payload::text)>200000 then raise exception 'Invalid input';end if;
 if action='claim' then
  insert into learning_private.coach_jobs(owner_id)
   select owner_id from public.learning_profiles p join private.members m on m.user_id=p.owner_id and m.active
   where personalization and not exists(select 1 from public.personal_vaults v where v.owner_id=p.owner_id) on conflict do nothing;
  select j.* into job from learning_private.coach_jobs j join public.learning_profiles p on p.owner_id=j.owner_id
   join private.members m on m.user_id=j.owner_id and m.active
   where p.personalization and not exists(select 1 from public.personal_vaults v where v.owner_id=j.owner_id)
   and j.available_at<=now() and (j.leased_until is null or j.leased_until<now())
   and (payload->>'ownerId' is null or j.owner_id=(payload->>'ownerId')::uuid)
   order by available_at for update of j skip locked limit 1;
  if job.owner_id is null then return null;end if;
  token:=gen_random_uuid();
  update learning_private.coach_jobs set lease=token,leased_until=now()+interval '3 minutes',attempts=attempts+1 where owner_id=job.owner_id;
  return jsonb_build_object('ownerId',job.owner_id,'token',token);
 end if;
 uid:=(payload->>'ownerId')::uuid;token:=(payload->>'token')::uuid;
 select * into job from learning_private.coach_jobs where owner_id=uid and lease=token and leased_until>now() for update;
 if job.owner_id is null then raise exception 'Lease expired';end if;
 if action='fail' then
  update learning_private.coach_jobs set lease=null,leased_until=null,available_at=now()+make_interval(secs=>least(3600,60*(2^least(attempts,5))::integer)),last_error='preparation_failed' where owner_id=uid;
  return jsonb_build_object('released',true);
 end if;
 perform 1 from private.members where user_id=uid and active for update;
 if not found or not exists(select 1 from public.learning_profiles where owner_id=uid and personalization) or exists(select 1 from public.personal_vaults where owner_id=uid) then raise exception 'Personalization disabled' using errcode='42501';end if;
 select (now() at time zone time_zone)::date into today from public.learning_profiles where owner_id=uid;
 if action='load' then
  return jsonb_build_object('today',today,'locale',(select locale from public.learning_profiles where owner_id=uid),
   'fingerprint',learning_private.coach_fingerprint(uid),
   'sources',coalesce((select jsonb_agg(to_jsonb(s) order by date) from learning_private.coach_sources(uid) s where date<=today),'[]'),
   'indexed',coalesce((select jsonb_agg(to_jsonb(s)-'owner_id') from learning_private.coach_index s where owner_id=uid),'[]'),
   'memories',coalesce((select jsonb_agg(to_jsonb(s)-'owner_id' order by source_date) from public.learning_memories s where owner_id=uid and active),'[]'),
   'history',coalesce((select jsonb_agg(to_jsonb(s)-'owner_id' order by date) from public.learning_days s where owner_id=uid and date<=today),'[]'),
   'completed',coalesce((select jsonb_agg(to_jsonb(s)-'owner_id'-'snapshot') from public.learning_completions s where owner_id=uid),'[]'),
   'ignoredDates',coalesce((select jsonb_agg(date) from learning_private.coach_exclusions where owner_id=uid),'[]'),
   'pages',coalesce((select jsonb_agg(to_jsonb(s)-'owner_id'-'adaptation') from learning_private.coach_pages s where owner_id=uid and date>=today),'[]'),
   'targets',jsonb_build_array(learning_private.coach_target(uid,today),learning_private.coach_target(uid,today+1)));
 elsif action='remember' then
  select * into src from learning_private.coach_sources(uid) where date=(payload->>'date')::date and date<=today;
  if src.hash is null or src.hash<>payload->>'hash' then return jsonb_build_object('stale',true);end if;
  if exists(select 1 from learning_private.coach_index where owner_id=uid and date=src.date and source_hash=src.hash) then return jsonb_build_object('saved',true);end if;
  if jsonb_array_length(payload->'memories')>6 then raise exception 'Too many memories';end if;
  delete from public.learning_memories where owner_id=uid and source_date=src.date and origin<>'manual';
  for m in select * from jsonb_array_elements(payload->'memories') loop
   if length(m->>'text') not between 5 and 400 or length(m->>'excerpt') not between 5 and 700 or strpos(src.text,m->>'excerpt')=0 then raise exception 'Invalid evidence';end if;
   if m->>'experimentDate' is not null and ((m->>'experimentDate')::date>src.date or not exists(select 1 from public.learning_days where owner_id=uid and date=(m->>'experimentDate')::date and length(adaptation->>'experiment')>0)) then raise exception 'Invalid experiment';end if;
   for old_id in select jsonb_array_elements_text(coalesce(m->'supersedes','[]')) loop
    update public.learning_memories set active=false where owner_id=uid and id=old_id::uuid and source_date<=src.date;
   end loop;
   insert into public.learning_memories(owner_id,text,source_date,category,status,source_hash,excerpt,topic,kind,origin,experiment_date)
   values(uid,m->>'text',src.date,m->>'category','confirmed',src.hash,m->>'excerpt',m->>'topic',m->>'kind','automatic',(m->>'experimentDate')::date);
  end loop;
  insert into learning_private.coach_index values(uid,src.date,src.hash,now()) on conflict(owner_id,date) do update set source_hash=excluded.source_hash,indexed_at=now();
  return jsonb_build_object('saved',true);
 elsif action='prune' then
  delete from public.learning_memories m where owner_id=uid and origin<>'manual' and not exists(select 1 from learning_private.coach_sources(uid) s where s.date=m.source_date);
  delete from learning_private.coach_index i where owner_id=uid and not exists(select 1 from learning_private.coach_sources(uid) s where s.date=i.date);
  return jsonb_build_object('saved',true);
 elsif action='page' then
  fp:=learning_private.coach_fingerprint(uid); target:=learning_private.coach_target(uid,(payload->>'date')::date);p:=payload->'adaptation';
  if fp<>payload->>'fingerprint' or target is null or target->'snapshot'<>payload->'snapshot' or coalesce((target->>'quiet')::boolean,false) then return jsonb_build_object('stale',true);end if;
  if p->>'version'<>'4' or length(p->>'introduction') not between 10 and 700 or length(p->>'teaching') not between 40 and 4000 or length(p->>'experiment') not between 10 and 700 or length(p->>'question')>500 then raise exception 'Invalid page';end if;
  for old_id in select jsonb_array_elements_text(coalesce(p->'usedMemoryIds','[]')) loop
   if not exists(select 1 from public.learning_memories where owner_id=uid and id=old_id::uuid and active and status='confirmed') then raise exception 'Invalid memory reference';end if;
  end loop;
  insert into learning_private.coach_pages(owner_id,date,document_id,snapshot,fingerprint,locale,adaptation)
  values(uid,(payload->>'date')::date,(target->>'document_id')::uuid,target->'snapshot',fp,payload->>'locale',p)
  on conflict(owner_id,date) do update set document_id=excluded.document_id,snapshot=excluded.snapshot,fingerprint=excluded.fingerprint,locale=excluded.locale,adaptation=excluded.adaptation,created_at=now();
  -- Already-open pages stay stable; newly available pages use the prepared cache on first open.
  update public.learning_days set adaptation=p,revision=revision+1 where owner_id=uid and date=(payload->>'date')::date and opened_at is null and not quiet and snapshot=target->'snapshot';
  return jsonb_build_object('saved',true);
 elsif action='finish' then
  update learning_private.coach_jobs set lease=null,leased_until=null,available_at=now()+make_interval(secs=>case when coalesce((payload->>'more')::boolean,false) then 10 else 300 end),attempts=0,last_success=now(),last_error=null where owner_id=uid;
  -- Bounded cache; history lives in immutable learning_days.
  delete from learning_private.coach_pages where owner_id=uid and date<today-1;
  return jsonb_build_object('saved',true);
 end if;
 raise exception 'Invalid action';
end $$;
revoke all on function public.learning_worker(text,text,jsonb) from public;
grant execute on function public.learning_worker(text,text,jsonb) to anon;
-- Internal helpers are not callable through an authenticated user's SQL privileges.
revoke all on function learning_private.coach_sources(uuid),learning_private.coach_fingerprint(uuid),learning_private.coach_target(uuid,date),learning_private.enqueue_coach(uuid,integer),learning_private.coach_changed() from public,anon,authenticated;
insert into learning_private.coach_jobs(owner_id) select owner_id from public.learning_profiles where personalization;

revoke all on function learning_private.program_action_v3(text,jsonb) from public,anon,authenticated;
