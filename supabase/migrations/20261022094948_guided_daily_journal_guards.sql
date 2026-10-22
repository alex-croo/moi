-- Do not skip an unpublished next step; require revisions even through direct RPC.
create or replace function learning_private.program_action(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); tz text; today date; target date; doc public.learning_documents;
 day public.learning_days; module public.learning_modules; result jsonb; current_note jsonb;
 request_id uuid; req learning_private.ai_requests; note_key text; v integer; p jsonb;
begin
 -- Every mutation and progress decision serializes on this owner's membership row.
 perform 1 from private.members where user_id=uid and active for update;
 if uid is null or not found or not public.current_user_allowed() then raise exception 'Forbidden' using errcode='42501'; end if;
 if (action in ('note','finish_ai','admin_review','admin_publish','admin_archive','admin_restore') or (action='admin_save' and payload->>'id' is not null))
    and (payload->>'expectedRevision' is null or payload->>'expectedRevision' !~ '^[0-9]+$') then raise exception 'Revision required' using errcode='40001'; end if;
 if octet_length(payload::text)>150000 then raise exception 'Invalid input'; end if;
 if action like 'admin_%' then
  if not public.current_user_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
  if action='admin_module' then
   if length(trim(payload->>'title')) not between 3 and 180 then raise exception 'Invalid title'; end if;
   perform pg_advisory_xact_lock(730092);
   insert into public.learning_modules(position,title,objective) values((select coalesce(max(position),0)+1 from public.learning_modules),trim(payload->>'title'),coalesce(payload->>'objective',''));
  elsif action='admin_save' then
   if payload->>'id' is null then
    perform pg_advisory_xact_lock(730092);
    insert into public.learning_documents(module_id,position,draft,status) values((payload->>'moduleId')::uuid,(select coalesce(max(position),0)+1 from public.learning_documents),payload->'content','draft') returning * into doc;
   else
    select * into doc from public.learning_documents where id=(payload->>'id')::uuid for update;
    if doc.id is null or doc.revision<>(payload->>'expectedRevision')::integer then raise exception 'Conflict' using errcode='40001'; end if;
    update public.learning_documents set draft=payload->'content',revision=revision+1,status='draft',updated_at=now() where id=doc.id returning * into doc;
   end if;
   insert into public.learning_versions(document_id,revision,content,status,editor) values(doc.id,doc.revision,doc.draft,'draft',uid);
  elsif action in ('admin_review','admin_publish','admin_archive','admin_restore') then
   select * into doc from public.learning_documents where id=(payload->>'id')::uuid for update;
   if doc.id is null or doc.revision<>(payload->>'expectedRevision')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   if action='admin_publish' and (length(doc.draft->>'body')<40 or jsonb_array_length(doc.draft->'sources')<1 or coalesce(payload->>'reviewed','false')<>'true') then raise exception 'Review required'; end if;
   p:=doc.draft;
   if action='admin_restore' then
    select content into p from public.learning_versions where document_id=doc.id and revision=(payload->>'version')::integer;
    if p is null then raise exception 'Version unavailable'; end if;
   end if;
   update public.learning_documents set revision=revision+1,draft=p,
    status=case action when 'admin_publish' then 'published' when 'admin_review' then 'review' when 'admin_archive' then 'archived' else 'draft' end,
    published=case when action='admin_publish' then draft when action='admin_archive' then null else published end,
    published_revision=case when action='admin_publish' then revision+1 else published_revision end,updated_at=now()
    where id=doc.id returning * into doc;
   insert into public.learning_versions(document_id,revision,content,status,editor) values(doc.id,doc.revision,doc.draft,doc.status,uid);
  elsif action='admin_versions' then
   return coalesce((select jsonb_agg(to_jsonb(x)-'editor' order by revision desc) from public.learning_versions x where document_id=(payload->>'id')::uuid),'[]');
  elsif action<>'admin_list' then raise exception 'Invalid action'; end if;
  return jsonb_build_object('modules',coalesce((select jsonb_agg(to_jsonb(m) order by position) from public.learning_modules m),'[]'),
   'documents',coalesce((select jsonb_agg(to_jsonb(d) order by position) from public.learning_documents d),'[]'));
 end if;
 tz:=coalesce(payload->>'timeZone','America/Toronto');
 if not exists(select 1 from pg_timezone_names where name=tz) then tz:='America/Toronto'; end if;
 insert into public.learning_profiles(owner_id,time_zone) values(uid,tz) on conflict do nothing;
 select time_zone into tz from public.learning_profiles where owner_id=uid;
 today:=(clock_timestamp() at time zone tz)::date;
 target:=coalesce((payload->>'date')::date,today);
 if action='preferences' then
  if exists(select 1 from public.personal_vaults where owner_id=uid) and (payload->>'enabled')::boolean then raise exception 'Vault migration required'; end if;
  update public.learning_profiles set personalization=(payload->>'enabled')::boolean,consent_at=case when (payload->>'enabled')::boolean then now() else null end where owner_id=uid;
 elsif action='memory' then
  if payload->>'operation'='forget' then delete from public.learning_memories where owner_id=uid and id=(payload->>'id')::uuid;
  elsif payload->>'operation'='forget_all' then delete from public.learning_memories where owner_id=uid;
  else update public.learning_memories set text=coalesce(payload->>'text',text),status='confirmed' where owner_id=uid and id=(payload->>'id')::uuid; end if;
 elsif action='ensure' and target=today then
  if not exists(select 1 from public.learning_days where owner_id=uid and date=target) then
   -- Resume the exact unfinished snapshot; new content cannot move an existing milestone.
   select * into day from public.learning_days d where owner_id=uid and not exists(select 1 from public.learning_completions c where c.owner_id=uid and c.document_id=d.document_id) order by date desc limit 1;
   if day.document_id is not null then
    insert into public.learning_days(owner_id,date,document_id,snapshot) values(uid,today,day.document_id,day.snapshot);
   elsif not exists(select 1 from public.learning_completions where owner_id=uid and completed_on>=today) then
    select * into doc from public.learning_documents d where status<>'archived' and not exists(select 1 from public.learning_completions c where c.owner_id=uid and c.document_id=d.id) order by position limit 1;
    if doc.id is not null and doc.published is not null then
     select * into module from public.learning_modules where id=doc.module_id;
     insert into public.learning_days(owner_id,date,document_id,snapshot) values(uid,today,doc.id,doc.published||jsonb_build_object('moduleTitle',module.title,'version',doc.published_revision));
    end if;
   end if;
  end if;
 elsif action='complete' then
  select * into day from public.learning_days where owner_id=uid and date=target for update;
  if day.document_id is null or target<>today then raise exception 'Today only' using errcode='40001'; end if;
  if not exists(select 1 from public.learning_completions where owner_id=uid and document_id=day.document_id) then
   if exists(select 1 from public.learning_completions where owner_id=uid and completed_on>=today) then raise exception 'One step per day' using errcode='40001'; end if;
   insert into public.learning_completions values(uid,day.document_id,today,day.snapshot);
  end if;
 elsif action='note' then
  if exists(select 1 from public.personal_vaults where owner_id=uid) then raise exception 'Vault migration required'; end if;
  note_key:=payload->>'key';
  if length(coalesce(payload->>'text',''))>20000 or length(note_key)>80 then raise exception 'Invalid note'; end if;
  select * into day from public.learning_days where owner_id=uid and date=target for update;
  if day.document_id is null then raise exception 'Day unavailable'; end if;
  if note_key<>'reflection' and not exists(select 1 from jsonb_array_elements(day.questions) q where q->>'id'=note_key) then raise exception 'Question unavailable'; end if;
  current_note:=day.notes->note_key;
  v:=coalesce((current_note->>'revision')::integer,0);
  if v<>(payload->>'expectedRevision')::integer then
   if current_note->>'text'=payload->>'text' then return current_note; end if;
   raise exception 'Note conflict' using errcode='40001';
  end if;
  p:=jsonb_build_object('text',payload->>'text','revision',v+1);
  update public.learning_days set notes=jsonb_set(notes,array[note_key],p),revision=revision+1,reflection_skipped=false where owner_id=uid and date=target;
  -- Old interpretations become invalid when the source note changes.
  delete from public.learning_memories where owner_id=uid and source_date=target and status='suggested';
  return p;
 elsif action in ('quiet','skip') then
  update public.learning_days set quiet=case when action='quiet' then (payload->>'enabled')::boolean else quiet end,
   reflection_skipped=case when action='skip' then (payload->>'enabled')::boolean else reflection_skipped end where owner_id=uid and date=target;
 elsif action='reserve_ai' then
  if exists(select 1 from public.personal_vaults where owner_id=uid) or not exists(select 1 from public.learning_profiles where owner_id=uid and personalization) then raise exception 'Personalization disabled' using errcode='42501'; end if;
  select * into day from public.learning_days where owner_id=uid and date=target;
  if day.document_id is null or day.quiet or target<>today then raise exception 'Unavailable'; end if;
  if (select count(*) from learning_private.ai_requests where owner_id=uid and date=today)>=4 or exists(select 1 from learning_private.ai_requests where owner_id=uid and not finished and created_at>now()-interval '2 minutes') then raise exception 'Rate limit' using errcode='53300'; end if;
  insert into learning_private.ai_requests(owner_id,date,kind) values(uid,target,coalesce(payload->>'kind','followup')) returning id into request_id;
  return jsonb_build_object('requestId',request_id,'day',to_jsonb(day)-'owner_id');
 elsif action='finish_ai' then
  select * into req from learning_private.ai_requests where id=(payload->>'requestId')::uuid and owner_id=uid and not finished for update;
  if req.id is null then raise exception 'Request unavailable'; end if;
  update learning_private.ai_requests set finished=true where id=req.id;
  if not exists(select 1 from public.learning_profiles where owner_id=uid and personalization) or exists(select 1 from public.personal_vaults where owner_id=uid) then raise exception 'Personalization disabled' using errcode='42501'; end if;
  select * into day from public.learning_days where owner_id=uid and date=req.date for update;
  if day.quiet or day.revision<>(payload->>'expectedRevision')::integer then return jsonb_build_object('stale',true); end if;
  p:=payload->'result';
  if length(p->>'question') not between 10 and 500 or length(p->>'introduction')>700 or length(p->>'experiment')>700 then raise exception 'Invalid result'; end if;
  update public.learning_days set adaptation=case when adaptation is null then jsonb_build_object('introduction',p->>'introduction','experiment',p->>'experiment') else adaptation end,
   questions=questions||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'text',p->>'question','source','assistant','createdAt',now())),revision=revision+1 where owner_id=uid and date=req.date;
  for current_note in select * from jsonb_array_elements(coalesce(p->'memories','[]')) loop
   if (current_note->>'sourceDate')::date<=today and (select count(*) from public.learning_memories where owner_id=uid)<60 then
    insert into public.learning_memories(owner_id,text,source_date,category) values(uid,current_note->>'text',(current_note->>'sourceDate')::date,current_note->>'category');
   end if;
  end loop;
 elsif action not in ('state','ensure') then raise exception 'Invalid action'; end if;
 select * into day from public.learning_days where owner_id=uid and date=target;
 if day.document_id is not null then
  select m.* into module from public.learning_modules m join public.learning_documents d on d.module_id=m.id where d.id=day.document_id;
 end if;
 result:=jsonb_build_object('today',today,'timeZone',tz,'personalization',(select personalization from public.learning_profiles where owner_id=uid),
  'day',case when day.document_id is null then null else to_jsonb(day)-'owner_id' end,
  'dates',coalesce((select jsonb_agg(date order by date desc) from public.learning_days where owner_id=uid),'[]'),
  'pages',coalesce((select jsonb_agg(jsonb_build_object('date',date,'title',snapshot->>'title','documentId',document_id,'journalDone',exists(select 1 from jsonb_each(notes) n where length(trim(n.value->>'text'))>0)) order by date desc) from public.learning_days where owner_id=uid),'[]'),
  'completed',coalesce((select jsonb_agg(jsonb_build_object('document_id',document_id,'completed_on',completed_on,'title',snapshot->>'title','moduleTitle',snapshot->>'moduleTitle') order by completed_on) from public.learning_completions where owner_id=uid),'[]'),
  'memories',coalesce((select jsonb_agg(to_jsonb(m)-'owner_id' order by created_at desc) from public.learning_memories m where owner_id=uid),'[]'),
  'currentModule',case when module.id is null then null else jsonb_build_object('title',module.title,
   'completed',(select count(*) from public.learning_completions c join public.learning_documents d on d.id=c.document_id where c.owner_id=uid and d.module_id=module.id),
   'total',(select count(*) from public.learning_documents where module_id=module.id and published is not null)) end,
  'waiting',exists(select 1 from public.learning_completions where owner_id=uid and completed_on>=today),
  'encrypted',exists(select 1 from public.personal_vaults where owner_id=uid));
 return result;
end $$;
