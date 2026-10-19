-- Catalogs are published by Codex through the database administrator, never from the browser.
create table public.ingredients (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[a-z0-9-]{1,100}$'),
  details jsonb not null check (jsonb_typeof(details)='object'),
  primary key (owner_id,id)
);
create table public.recipe_assets (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[a-z0-9-]{1,100}$'),
  mime text not null check (mime in ('image/jpeg','image/png','image/webp')),
  data text not null check (octet_length(data) <= 4000000),
  primary key (owner_id,id)
);
create table public.recipes (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[a-z0-9-]{1,100}$'),
  details jsonb not null check (jsonb_typeof(details)='object'),
  primary key (owner_id,id)
);
create table public.recipe_ingredients (
  owner_id uuid not null,
  recipe_id text not null,
  ingredient_id text not null,
  position integer not null check(position>=0),
  grams numeric not null check(grams>0 and grams<=100000),
  quantity jsonb not null check(jsonb_typeof(quantity)='object'),
  note text,
  optional boolean not null default false,
  primary key(owner_id,recipe_id,position),
  foreign key(owner_id,recipe_id) references public.recipes(owner_id,id) on delete cascade,
  foreign key(owner_id,ingredient_id) references public.ingredients(owner_id,id)
);
create index recipe_ingredients_ingredient on public.recipe_ingredients(owner_id,ingredient_id);
create table public.meal_slots (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  slot text not null check(slot in ('lunch','dinner')),
  recipe_id text not null,
  primary key(owner_id,date,slot),
  foreign key(owner_id,recipe_id) references public.recipes(owner_id,id)
);
create index meal_slots_recipe on public.meal_slots(owner_id,recipe_id);
create table public.unit_preferences (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  units jsonb not null check (
    jsonb_typeof(units)='object' and
    units->>'bodyMass' in ('lb','kg') and units->>'ingredientMass' in ('g','oz') and
    units->>'volume' in ('ml','cup','fl_oz') and units->>'spoons' in ('spoon','ml') and
    units->>'temperature' in ('C','F') and units->>'length' in ('cm','in') and
    units ?& array['bodyMass','ingredientMass','volume','spoons','temperature','length']
  )
);
do $$ declare t text; begin
  foreach t in array array['ingredients','recipe_assets','recipes','recipe_ingredients','meal_slots','unit_preferences'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy owner_read on public.%I for select to authenticated using ((select public.current_user_allowed()) and owner_id=(select auth.uid()))',t);
  end loop;
  foreach t in array array['meal_slots','unit_preferences'] loop
    execute format('grant insert,update,delete on public.%I to authenticated',t);
    execute format('create policy owner_write on public.%I for all to authenticated using ((select public.current_user_allowed()) and owner_id=(select auth.uid())) with check ((select public.current_user_allowed()) and owner_id=(select auth.uid()))',t);
  end loop;
end $$;

alter table public.journal_entries add column title text not null default '' check(length(title)<=160);
alter table public.journal_entries add column revision integer not null default 1 check(revision>0);
-- Atomic compare-and-save avoids overwriting an entry changed in another tab.
create function public.save_journal(entry_date date, entry_text text, entry_title text, entry_mood integer, expected_revision integer)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if expected_revision=0 then
    insert into public.journal_entries(owner_id,date,text,title,mood) values(auth.uid(),entry_date,entry_text,entry_title,entry_mood);
  else
    update public.journal_entries set text=entry_text,title=entry_title,mood=entry_mood,revision=revision+1
    where owner_id=auth.uid() and date=entry_date and revision=expected_revision;
    if not found then raise exception 'Journal changed' using errcode='40001'; end if;
  end if;
end $$;
revoke all on function public.save_journal(date,text,text,integer,integer) from public,anon;
grant execute on function public.save_journal(date,text,text,integer,integer) to authenticated;

-- No journal content is recorded in the rate limiter. Only the definer function can write it.
create table private.ai_edit_usage (user_id uuid references auth.users(id) on delete cascade, window_start timestamptz not null, requests integer not null, primary key(user_id,window_start));
alter table private.ai_edit_usage enable row level security;
revoke all on private.ai_edit_usage from public,anon,authenticated;
create function public.reserve_ai_edit() returns boolean language plpgsql security definer set search_path='' as $$
declare used integer;
begin
  if not public.current_user_allowed() then return false; end if;
  insert into private.ai_edit_usage(user_id,window_start,requests) values(auth.uid(),date_trunc('hour',now()),1)
  on conflict(user_id,window_start) do update set requests=private.ai_edit_usage.requests+1 where private.ai_edit_usage.requests<20
  returning requests into used;
  delete from private.ai_edit_usage where window_start < now()-interval '2 days';
  return used is not null;
end $$;
revoke all on function public.reserve_ai_edit() from public,anon;
grant execute on function public.reserve_ai_edit() to authenticated;
