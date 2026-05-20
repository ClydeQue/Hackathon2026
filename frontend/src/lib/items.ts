import * as Crypto from 'expo-crypto';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { STORAGE_BUCKET, supabase } from './supabase';
import type { ClothingItem, ItemCategory, ItemCondition, ItemStatus } from '@/types';

function base64ToBytes(b64: string): Uint8Array {
  const bin = global.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type CreateItemInput = {
  uri: string;
  status: ItemStatus;
  category?: ItemCategory;
  color?: string | null;
  material?: string | null;
  brand?: string | null;
  condition?: ItemCondition;
  ai_tags?: Record<string, unknown> | null;
};

// Uploads the picked photo to storage and inserts a clothing_items row.
// Shared by the add-tab flow and the onboarding/bulk flows.
export async function createItemFromPickedPhoto(input: CreateItemInput): Promise<ClothingItem> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not signed in.');

  const base64 = await readAsStringAsync(input.uri, { encoding: 'base64' });
  const bytes = base64ToBytes(base64);
  if (bytes.byteLength === 0) throw new Error('Read 0 bytes from picked photo.');

  const itemId = Crypto.randomUUID();
  const path = `${u.user.id}/${itemId}.jpg`;

  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (upErr) {
    if (/bucket.*not found/i.test(upErr.message)) {
      throw new Error(
        `Storage bucket "${STORAGE_BUCKET}" is missing. Run supabase/migrations/0002_storage.sql.`,
      );
    }
    throw upErr;
  }

  const { data, error: insErr } = await supabase
    .from('clothing_items')
    .insert({
      id: itemId,
      owner_id: u.user.id,
      photo_path: path,
      category: input.category ?? 'other',
      color: input.color ?? null,
      material: input.material ?? null,
      brand: input.brand ?? null,
      condition: input.condition ?? 'good',
      ai_tags: input.ai_tags ?? null,
      status: input.status,
    })
    .select()
    .single();
  if (insErr) throw insErr;
  return data as ClothingItem;
}
