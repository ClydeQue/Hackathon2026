-- =====================================================================
-- profiles.onboarded_at
--
-- Tracks whether the user has been through the wardrobe-seeding swipe
-- flow. NULL = hasn't seen onboarding yet; the root layout uses this to
-- route new accounts to /onboarding instead of /(tabs). Skipping also
-- stamps a value so we don't re-prompt.
-- =====================================================================

alter table profiles add column if not exists onboarded_at timestamptz;

-- Backfill existing accounts so they're not unexpectedly routed through
-- the new wardrobe-seeding flow. Anyone who already has a profile row
-- is implicitly past onboarding.
update profiles set onboarded_at = now() where onboarded_at is null;
