-- =====================================================================
-- Dev cleanup: clear all swipe history.
--
-- The feed excludes any item the current user has already swiped on, so
-- once you've swiped through everything (especially across multiple test
-- accounts), the deck reads empty. Truncating `swipes` resets the deck
-- for every account — donation items become visible again until they're
-- re-swiped.
--
-- Safe to re-run; the table is idempotent and items themselves are
-- untouched. Run in Supabase Studio → SQL Editor.
-- =====================================================================

truncate table swipes;
