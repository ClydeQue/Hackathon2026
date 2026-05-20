-- =====================================================================
-- Storage: allow authenticated users to read photos of clothing_items
-- currently in `donate` status. Needed so the feed (and cart) can
-- generate signed URLs for items owned by other users.
--
-- Policies are OR'd, so this stacks on top of `garments_read_own`
-- without weakening it.
-- =====================================================================

drop policy if exists "garments_read_donate" on storage.objects;
create policy "garments_read_donate" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'garments'
    and exists (
      select 1
      from clothing_items ci
      where ci.photo_path = storage.objects.name
        and ci.status = 'donate'
    )
  );
