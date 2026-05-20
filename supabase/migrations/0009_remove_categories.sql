-- =====================================================================
-- Drop 'shoes' and 'accessory' from item_category. Existing rows with
-- those values are migrated to 'other' before the enum is rebuilt.
--
-- Comparing an enum column to a literal that's NOT in the enum (anymore)
-- throws 22P02 — so we cast to text everywhere we touch the old values.
-- The whole script is idempotent: safe to re-run after a partial failure.
-- =====================================================================

-- 1. Reassign any leftover rows (cast both sides to text so we don't care
--    whether the enum still contains 'shoes' / 'accessory').
update clothing_items
   set category = 'other'
 where category::text in ('shoes', 'accessory');

-- 2. Rebuild the enum only if it still has the removed values.
do $$
begin
  if exists (
    select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
     where t.typname = 'item_category'
       and e.enumlabel in ('shoes', 'accessory')
  ) then
    -- Park the old enum to the side so we can swap.
    alter type item_category rename to item_category_old;

    create type item_category as enum (
      'top',
      'bottom',
      'outerwear',
      'dress',
      'other'
    );

    alter table clothing_items
      alter column category type item_category
      using category::text::item_category;

    drop type item_category_old;
  end if;
end$$;
