-- =====================================================================
-- Adds a `condition` field to clothing_items. AI fills it on scan;
-- the user can override on the Add screen before saving.
-- =====================================================================

do $$ begin
  create type item_condition as enum (
    'damaged',
    'used',
    'barely_used',
    'good',
    'brand_new'
  );
exception when duplicate_object then null; end $$;

alter table clothing_items
  add column if not exists condition item_condition not null default 'good';
