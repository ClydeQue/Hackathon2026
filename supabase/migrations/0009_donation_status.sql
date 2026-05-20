-- =====================================================================
-- Donation progress lifecycle
--   pending  -> recipient right-swiped, donor hasn't decided yet
--   accepted -> donor accepted this requester; siblings auto-decline
--   received -> recipient confirmed hand-off (terminal success)
--   declined -> donor declined / recipient cancelled / auto-cascade
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'donation_status') then
    create type donation_status as enum ('pending', 'accepted', 'received', 'declined');
  end if;
end$$;

alter table swipes
  add column if not exists status donation_status not null default 'pending';

alter table swipes
  add column if not exists decided_at timestamptz;

create index if not exists swipes_item_status_idx on swipes(item_id, status);

-- ---------------------------------------------------------------------
-- Trigger: when a swipe is accepted, decline every other pending right-
-- swipe on the same item. Also stamps decided_at on every status change.
-- ---------------------------------------------------------------------
create or replace function swipes_on_status_change() returns trigger as $$
begin
  if new.status is distinct from old.status then
    new.decided_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists swipes_stamp_decided_at on swipes;
create trigger swipes_stamp_decided_at
  before update on swipes
  for each row execute procedure swipes_on_status_change();

create or replace function swipes_cascade_decline() returns trigger as $$
begin
  if new.status = 'accepted'
     and (old.status is null or old.status <> 'accepted') then
    update swipes
       set status = 'declined'
     where item_id = new.item_id
       and id <> new.id
       and direction = 'right'
       and status = 'pending';
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists swipes_auto_decline_siblings on swipes;
create trigger swipes_auto_decline_siblings
  after update of status on swipes
  for each row execute procedure swipes_cascade_decline();

-- ---------------------------------------------------------------------
-- RLS: donors need to see + update swipes on their own items.
-- Recipients still own their own swipes.
-- ---------------------------------------------------------------------
drop policy if exists "swipes_select_own" on swipes;
create policy "swipes_select_own" on swipes
  for select using (
    swiper_id = auth.uid()
    or exists (
      select 1 from clothing_items ci
      where ci.id = item_id and ci.owner_id = auth.uid()
    )
  );

drop policy if exists "swipes_update_own" on swipes;
create policy "swipes_update_own" on swipes
  for update using (
    swiper_id = auth.uid()
    or exists (
      select 1 from clothing_items ci
      where ci.id = item_id and ci.owner_id = auth.uid()
    )
  ) with check (
    swiper_id = auth.uid()
    or exists (
      select 1 from clothing_items ci
      where ci.id = item_id and ci.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- Denormalized claim flag on clothing_items so the public feed can hide
-- reserved items without reading other users' swipe rows. Sync trigger
-- on swipes keeps this in lockstep.
-- ---------------------------------------------------------------------
alter table clothing_items
  add column if not exists claimed_at timestamptz;

create index if not exists clothing_items_claimed_at_idx
  on clothing_items(claimed_at)
  where status = 'donate';

create or replace function swipes_sync_item_claim() returns trigger as $$
declare
  target_item uuid := coalesce(new.item_id, old.item_id);
  has_claim boolean;
begin
  select exists (
    select 1 from swipes
    where item_id = target_item
      and direction = 'right'
      and status in ('accepted', 'received')
  ) into has_claim;

  update clothing_items
  set claimed_at = case
    when has_claim then coalesce(claimed_at, now())
    else null
  end
  where id = target_item;

  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists swipes_sync_item_claim_iud on swipes;
create trigger swipes_sync_item_claim_iud
  after insert or update of status or delete on swipes
  for each row execute procedure swipes_sync_item_claim();
