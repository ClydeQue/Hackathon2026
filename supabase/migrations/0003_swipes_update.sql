-- Allow a user to update their own swipe rows. Used by the cart's "remove"
-- action, which flips a swipe from 'right' (in cart) to 'left' (passed) so
-- the item drops out of the cart without reappearing in the donation feed.

drop policy if exists "swipes_update_own" on swipes;
create policy "swipes_update_own" on swipes
  for update
  using (swiper_id = auth.uid())
  with check (swiper_id = auth.uid());
