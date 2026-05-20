# SlowFashion — Features

## Authentication
- Email + password sign-up and sign-in (Supabase Auth).
- Auto-created profile row on signup (display name defaults to email local-part).
- Session persistence; root layout redirects unauthenticated users to sign-in.

## Onboarding
- First-run flow gated by `profiles.onboarded_at`.
- Batch photo pick (up to 30 garments) from camera roll or camera.
- Swipe-based keep/archive/donate triage on the just-added items.
- Camera/photo permission denial handling with Settings deep-link.

## Wardrobe (Closet)
- Add a garment: pick or shoot a photo, tag with category, color, material, brand.
- AI auto-tagging via backend `/scan` endpoint (Gemini vision classifier).
- Edit and delete owned items.
- Item statuses: `keep`, `archive`, `donate`.
- Item detail screen with photo and editable tags.
- Closet reset utility.

## Collections
- Create, rename, delete user-curated collections.
- Many-to-many: an item can belong to any number of collections.
- Add/remove items from a collection; per-collection item list.

## Donate Feed (Swipes)
- Tinder-style deck of items others have marked `donate`.
- Right-swipe = save to cart; left-swipe = pass.
- YES/NOPE drag-distance stamp animation.
- One swipe per (user, item); exhausted state when deck empties.

## Cart
- List of right-swiped items grouped by donor.
- Per-donor contact modal exposing email / phone / handle (deep-links to mail, tel, etc.).

## Outfit Recommender
- Generates outfit combinations from the user's `keep` items via local recommender.
- Refresh to regenerate suggestions.

## Profile
- Edit display name and contact info (email, phone, handle).
- Upload / change avatar (image picker → Supabase Storage `avatars` bucket).
- Sign out.

## Backend
- Express server with `POST /scan`: multipart image upload, Gemini-powered garment classification, returns category/color/material/brand tags.
- Auth middleware validates Supabase JWT.

## Data & Storage
- Supabase Postgres with RLS on all user tables (profiles, clothing_items, swipes, collections, collection_items).
- Public read of items where `status = 'donate'` (cross-user); all other rows owner-scoped.
- Private storage buckets: `garments` (item photos), `avatars` (profile photos).
- Auto-stamped `donated_at` trigger when status flips to/from `donate`.
- `updated_at` touch trigger on items and collections.
