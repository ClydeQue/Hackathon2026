-- =====================================================================
-- Collections: user-curated subsets of their own clothing_items.
-- Many-to-many: an item can live in any number of collections.
-- =====================================================================

create table if not exists collections (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists collections_owner_idx on collections(owner_id, created_at desc);

drop trigger if exists collections_touch on collections;
create trigger collections_touch
  before update on collections
  for each row execute procedure public.touch_updated_at();

alter table collections enable row level security;

drop policy if exists "collections_select_own" on collections;
create policy "collections_select_own" on collections
  for select using (owner_id = auth.uid());

drop policy if exists "collections_insert_own" on collections;
create policy "collections_insert_own" on collections
  for insert with check (owner_id = auth.uid());

drop policy if exists "collections_update_own" on collections;
create policy "collections_update_own" on collections
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "collections_delete_own" on collections;
create policy "collections_delete_own" on collections
  for delete using (owner_id = auth.uid());

-- =====================================================================
-- collection_items: membership join. Cascading deletes keep the join
-- table tidy when collections or items disappear.
-- =====================================================================
create table if not exists collection_items (
  collection_id  uuid not null references collections(id) on delete cascade,
  item_id        uuid not null references clothing_items(id) on delete cascade,
  added_at       timestamptz not null default now(),
  primary key (collection_id, item_id)
);

create index if not exists collection_items_item_idx on collection_items(item_id);

alter table collection_items enable row level security;

-- A row is yours iff the parent collection is yours. clothing_items RLS
-- still applies on its own table, so this only authorizes the join.
drop policy if exists "collection_items_select_own" on collection_items;
create policy "collection_items_select_own" on collection_items
  for select using (
    exists (
      select 1 from collections c
      where c.id = collection_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "collection_items_insert_own" on collection_items;
create policy "collection_items_insert_own" on collection_items
  for insert with check (
    exists (
      select 1 from collections c
      where c.id = collection_id and c.owner_id = auth.uid()
    )
    and exists (
      select 1 from clothing_items ci
      where ci.id = item_id and ci.owner_id = auth.uid()
    )
  );

drop policy if exists "collection_items_delete_own" on collection_items;
create policy "collection_items_delete_own" on collection_items
  for delete using (
    exists (
      select 1 from collections c
      where c.id = collection_id and c.owner_id = auth.uid()
    )
  );
