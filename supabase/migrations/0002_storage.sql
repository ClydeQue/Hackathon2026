-- =====================================================================
-- Storage bucket: garments
-- Run in Supabase Studio SQL editor (or via `supabase db push`) so the
-- bucket and policies exist on the hosted instance.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('garments', 'garments', false)
on conflict (id) do nothing;

-- Owners can read their own files (first path segment is the owner's auth uid).
drop policy if exists "garments_read_own" on storage.objects;
create policy "garments_read_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'garments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owners can upload into their own folder.
drop policy if exists "garments_insert_own" on storage.objects;
create policy "garments_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'garments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owners can update their own files.
drop policy if exists "garments_update_own" on storage.objects;
create policy "garments_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'garments'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'garments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owners can delete their own files.
drop policy if exists "garments_delete_own" on storage.objects;
create policy "garments_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'garments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
