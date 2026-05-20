-- =====================================================================
-- When an item's status leaves 'donate' (e.g. the owner moves it back to
-- 'keep' from the closet), any open donation requests on it must close
-- and the denormalized claimed_at flag must clear. The swipes trigger
-- chain handles claimed_at automatically once we cascade the swipes.
-- =====================================================================

create or replace function public.handle_item_status_change() returns trigger as $$
begin
  if old.status = 'donate' and new.status is distinct from 'donate' then
    -- Close any outstanding requests. The swipes_sync_item_claim trigger
    -- on the swipes table will then clear claimed_at on this row.
    update swipes
       set status = 'declined'
     where item_id = new.id
       and direction = 'right'
       and status in ('pending', 'accepted');
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists clothing_items_status_cascade on clothing_items;
create trigger clothing_items_status_cascade
  after update of status on clothing_items
  for each row execute procedure public.handle_item_status_change();
