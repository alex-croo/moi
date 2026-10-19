-- Run once in the Supabase SQL editor. Never expose a service_role key to the app.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table private.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.members enable row level security;
revoke all on private.members from public, anon, authenticated;

create function public.current_user_allowed() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.members where user_id = (select auth.uid())); $$;
revoke all on function public.current_user_allowed() from public, anon;
grant execute on function public.current_user_allowed() to authenticated;

create table public.menu_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 160),
  title_en text not null check (char_length(title_en) between 1 and 160),
  start_date date not null,
  days jsonb not null check (jsonb_typeof(days) = 'array' and jsonb_array_length(days) = 6 and octet_length(days::text) <= 60000),
  created_at timestamptz not null default now()
);
create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  value numeric(6,2) not null check (value between 1 and 1500),
  unit text not null check (unit in ('lb','kg')),
  created_at timestamptz not null default now(),
  unique (owner_id, date)
);
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  text text not null check (char_length(text) between 1 and 20000),
  mood smallint not null check (mood between 1 and 5),
  created_at timestamptz not null default now(),
  unique (owner_id, date)
);
create table public.document_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 160),
  url text not null check (char_length(url) <= 2048 and url ~ '^https://(drive|docs)\.google\.com/'),
  kind text not null check (kind in ('menu','recipe','journal','other')),
  created_at timestamptz not null default now()
);

do $$ declare t text;
begin
  foreach t in array array['menu_plans', 'weight_entries', 'journal_entries', 'document_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create index on public.%I (owner_id)', t);
    execute format('create policy owner_only on public.%I for all to authenticated using ((select public.current_user_allowed()) and owner_id = (select auth.uid())) with check ((select public.current_user_allowed()) and owner_id = (select auth.uid()))', t);
  end loop;
end $$;
commit;

-- After the owner's FIRST Google sign-in, add ONLY their verified auth user:
-- insert into private.members (user_id)
-- select id from auth.users where lower(email) = lower('OWNER_GOOGLE_EMAIL')
-- and email_confirmed_at is not null;
-- Other Google accounts can complete OAuth, but cannot enter the application
-- or access its tables. Removing membership immediately denies subsequent reads/writes.
