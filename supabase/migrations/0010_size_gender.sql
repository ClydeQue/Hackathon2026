-- =====================================================================
-- Optional size and gender labels on clothing items, surfaced on the
-- donation feed card. Both are free-text so users aren't boxed into a
-- specific sizing system (XS/S/M, US 30, EU 38, etc.).
-- =====================================================================

alter table clothing_items
  add column if not exists size text;

alter table clothing_items
  add column if not exists gender text;
