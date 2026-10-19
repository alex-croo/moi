begin;

-- Extend the existing planner without rewriting any chosen meals.
alter table public.meal_slots drop constraint meal_slots_slot_check;
alter table public.meal_slots add constraint meal_slots_slot_check
  check (slot in ('breakfast','morning_snack','lunch','afternoon_snack','dinner','evening_snack'));

create table public.grocery_checks (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  ingredient_id text not null,
  checked boolean not null default false,
  primary key (owner_id,week_start,ingredient_id),
  foreign key (owner_id,ingredient_id) references public.ingredients(owner_id,id) on delete cascade
);
create index grocery_checks_ingredient_idx on public.grocery_checks(owner_id,ingredient_id);

create table public.pantry_items (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  ingredient_id text,
  name text not null check (length(trim(name)) between 1 and 160),
  location text not null check (location in ('cupboard','fridge','freezer','spices')),
  quantity jsonb check (quantity is null or (
    jsonb_typeof(quantity) = 'object' and quantity ?& array['kind','value'] and
    quantity->>'kind' in ('mass','volume','spoon','count') and
    jsonb_typeof(quantity->'value') = 'number' and
    (quantity->>'value')::numeric > 0 and (quantity->>'value')::numeric <= 1000000
  )),
  note text not null default '' check (length(note) <= 160),
  in_stock boolean not null default true,
  primary key (owner_id,id),
  unique (owner_id,ingredient_id,location),
  foreign key (owner_id,ingredient_id) references public.ingredients(owner_id,id)
);

alter table public.grocery_checks enable row level security;
alter table public.pantry_items enable row level security;
revoke all on public.grocery_checks, public.pantry_items from public,anon,authenticated;
grant select,insert,update,delete on public.grocery_checks,public.pantry_items to authenticated;

do $$ declare tbl text; begin
  foreach tbl in array array['grocery_checks','pantry_items'] loop
    execute format('create policy owner_select on public.%I for select to authenticated using (owner_id = (select auth.uid()) and (select public.current_user_allowed()))', tbl);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check (owner_id = (select auth.uid()) and (select public.current_user_allowed()))', tbl);
    execute format('create policy owner_update on public.%I for update to authenticated using (owner_id = (select auth.uid()) and (select public.current_user_allowed())) with check (owner_id = (select auth.uid()) and (select public.current_user_allowed()))', tbl);
    execute format('create policy owner_delete on public.%I for delete to authenticated using (owner_id = (select auth.uid()) and (select public.current_user_allowed()))', tbl);
  end loop;
end $$;
commit;
