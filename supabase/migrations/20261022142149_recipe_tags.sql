-- Shared recipe vocabulary; contains no personal data.
create table public.recipe_tags (
 id text primary key check (id ~ '^[a-z0-9-]{1,80}$'),
 label text not null check (length(trim(label)) between 1 and 50),
 label_en text not null check (length(trim(label_en)) between 1 and 50),
 category text not null check (category in ('diet','type','tag')),
 created_at timestamptz not null default now()
);
create unique index recipe_tags_label_category on public.recipe_tags (category, lower(trim(label)));
alter table public.recipe_tags enable row level security;
revoke all on public.recipe_tags from public, anon, authenticated;
grant select, insert on public.recipe_tags to authenticated;
create policy recipe_tags_read on public.recipe_tags for select to authenticated using ((select public.current_user_allowed()));
create policy recipe_tags_create on public.recipe_tags for insert to authenticated with check ((select public.current_user_admin()) and (select public.current_user_allowed()));
