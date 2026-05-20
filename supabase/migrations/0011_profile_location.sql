-- =====================================================================
-- Pickup location on profiles. Required before a user can flip an item
-- to 'donate' so recipients always see a map pin on the donor screen.
-- Stored as plain double precision; we don't need PostGIS for a single
-- point per profile.
-- =====================================================================

alter table profiles
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;
