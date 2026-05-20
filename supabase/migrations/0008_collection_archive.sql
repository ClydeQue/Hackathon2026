-- =====================================================================
-- Per-collection archive shelf.
-- archived_at is null for active items in the collection; set to a
-- timestamp when the user shelves an item *within* the collection without
-- removing it from the collection or changing its global closet status.
-- =====================================================================

alter table collection_items
  add column if not exists archived_at timestamptz;

create index if not exists collection_items_collection_archived_idx
  on collection_items(collection_id, archived_at);

-- Owners of the parent collection can flip archived_at on / off.
drop policy if exists "collection_items_update_own" on collection_items;
create policy "collection_items_update_own" on collection_items
  for update using (
    exists (
      select 1 from collections c
      where c.id = collection_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from collections c
      where c.id = collection_id and c.owner_id = auth.uid()
    )
  );
