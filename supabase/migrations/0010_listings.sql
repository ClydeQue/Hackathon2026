-- =====================================================================
-- Donation listings.
--
-- Marking an item as 'donate' now creates a DRAFT listing. The owner
-- fills in pickup / message / availability on the /donate/[id] screen
-- and explicitly publishes it. Only published listings (listed_at IS
-- NOT NULL) are visible to other users in Discover.
--
-- Existing donate-status rows are grandfathered in as already-listed so
-- nothing drops out of Discover after the migration runs.
-- =====================================================================

alter table clothing_items
  add column if not exists listing_title    text,
  add column if not exists listing_message  text,
  add column if not exists pickup_note      text,
  add column if not exists available_until  timestamptz,
  add column if not exists listed_at        timestamptz;

-- Index the predicate Discover hits on every load.
create index if not exists clothing_items_listed_idx
  on clothing_items (listed_at desc)
  where status = 'donate' and listed_at is not null;

-- Backfill: anything already in donate status is considered listed.
update clothing_items
   set listed_at = coalesce(donated_at, now())
 where status = 'donate'
   and listed_at is null;

-- =====================================================================
-- RLS — tighten cross-user visibility to listed items only.
-- =====================================================================
drop policy if exists "items_select_own_or_donating" on clothing_items;
drop policy if exists "items_select_own_or_listed"   on clothing_items;
create policy "items_select_own_or_listed" on clothing_items
  for select using (
    owner_id = auth.uid()
    or (
      status = 'donate'
      and listed_at is not null
      and owner_id <> auth.uid()
    )
  );

-- Keep the donate-only index from 0001 alive (unchanged here on purpose).
