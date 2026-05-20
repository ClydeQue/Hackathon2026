-- SlowFashion initial schema
-- Run in the Supabase SQL editor (or via `supabase db push`).

-- =====================================================================
-- Extensions
-- =====================================================================
create extension if not exists "pgcrypto";

-- =====================================================================
-- Enums
-- =====================================================================
do $$ begin
  create type item_status as enum ('keep', 'archive', 'donate');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_category as enum ('top','bottom','outerwear','shoes','accessory','dress','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type swipe_direction as enum ('left','right');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- profiles
-- =====================================================================
create table if not exists profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  display_name   text not null,
  contact_email  text,
  contact_phone  text,
  contact_handle text,
  avatar_url     text,
  created_at     timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles_select_public" on profiles;
create policy "profiles_select_public" on profiles
  for select using (true);

drop policy if exists "profiles_insert_self" on profiles;
create policy "profiles_insert_self" on profiles
  for insert with check (user_id = auth.uid());

drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Auto-create a profile row on signup. display_name defaults to the email local-part;
-- the user can edit it on the Profile screen.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, contact_email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================================================================
-- clothing_items
-- =====================================================================
create table if not exists clothing_items (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  photo_path  text not null,
  category    item_category not null,
  color       text,
  material    text,
  brand       text,
  ai_tags     jsonb,
  status      item_status not null default 'keep',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  donated_at  timestamptz
);

create index if not exists clothing_items_owner_status_idx
  on clothing_items (owner_id, status);

create index if not exists clothing_items_donate_idx
  on clothing_items (status) where status = 'donate';

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clothing_items_touch on clothing_items;
create trigger clothing_items_touch
  before update on clothing_items
  for each row execute procedure public.touch_updated_at();

-- Stamp / clear donated_at when status flips into / out of 'donate'.
create or replace function public.handle_donate_stamp()
returns trigger language plpgsql as $$
begin
  if new.status = 'donate' and (old.status is distinct from 'donate') then
    new.donated_at = now();
  elsif new.status <> 'donate' then
    new.donated_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists clothing_items_donate_stamp on clothing_items;
create trigger clothing_items_donate_stamp
  before insert or update on clothing_items
  for each row execute procedure public.handle_donate_stamp();

alter table clothing_items enable row level security;

drop policy if exists "items_select_own_or_donating" on clothing_items;
create policy "items_select_own_or_donating" on clothing_items
  for select using (
    owner_id = auth.uid()
    or (status = 'donate' and owner_id <> auth.uid())
  );

drop policy if exists "items_insert_own" on clothing_items;
create policy "items_insert_own" on clothing_items
  for insert with check (owner_id = auth.uid());

drop policy if exists "items_update_own" on clothing_items;
create policy "items_update_own" on clothing_items
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "items_delete_own" on clothing_items;
create policy "items_delete_own" on clothing_items
  for delete using (owner_id = auth.uid());

-- =====================================================================
-- swipes
-- =====================================================================
create table if not exists swipes (
  id         uuid primary key default gen_random_uuid(),
  swiper_id  uuid not null references auth.users(id) on delete cascade,
  item_id    uuid not null references clothing_items(id) on delete cascade,
  direction  swipe_direction not null,
  created_at timestamptz not null default now(),
  unique (swiper_id, item_id)
);

create index if not exists swipes_swiper_dir_idx on swipes (swiper_id, direction);

alter table swipes enable row level security;

drop policy if exists "swipes_select_own" on swipes;
create policy "swipes_select_own" on swipes
  for select using (swiper_id = auth.uid());

drop policy if exists "swipes_insert_own" on swipes;
create policy "swipes_insert_own" on swipes
  for insert with check (swiper_id = auth.uid());

-- =====================================================================
-- Storage bucket: garments  (run as a separate snippet in Supabase Studio
-- if needed — buckets are not always created via SQL on hosted instances)
-- =====================================================================
-- insert into storage.buckets (id, name, public) values ('garments','garments', false)
--   on conflict (id) do nothing;
--
-- Storage RLS — owners can manage their own folder; donate-status items are
-- readable by anyone (signed URL still required because the bucket is private).
-- Adjust as needed in the Supabase dashboard.
