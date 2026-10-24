-- Translations are display copies. Canonical recipes, quantities and personal writing are never overwritten.
create table public.content_translations (
 owner_id uuid not null references auth.users(id) on delete cascade,
 locale text not null check (locale in ('es','pt-BR','en')),
 source_key text not null,
 source_hash text not null,
 strings jsonb not null check (jsonb_typeof(strings)='object'),
 created_at timestamptz not null default now(),
 primary key(owner_id,locale,source_key,source_hash)
);
alter table public.content_translations enable row level security;
revoke all on public.content_translations from anon, authenticated;
grant select,insert on public.content_translations to authenticated;
create policy translations_owner_select on public.content_translations for select to authenticated using(owner_id=auth.uid() and public.current_user_allowed());
create policy translations_owner_insert on public.content_translations for insert to authenticated with check(owner_id=auth.uid() and public.current_user_allowed());
