export type ItemStatus = 'keep' | 'archive' | 'donate';

export type ItemCategory =
  | 'top'
  | 'bottom'
  | 'outerwear'
  | 'dress'
  | 'other';

export type ItemCondition =
  | 'damaged'
  | 'used'
  | 'barely_used'
  | 'good'
  | 'brand_new';

export type SwipeDirection = 'left' | 'right';

export type Profile = {
  user_id: string;
  display_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_handle: string | null;
  avatar_url: string | null;
  latitude: number | null;
  longitude: number | null;
  onboarded_at: string | null;
  created_at: string;
};

export type ClothingItem = {
  id: string;
  owner_id: string;
  photo_path: string;
  category: ItemCategory;
  color: string | null;
  material: string | null;
  brand: string | null;
  condition: ItemCondition;
  size: string | null;
  gender: string | null;
  ai_tags: Record<string, unknown> | null;
  status: ItemStatus;
  created_at: string;
  updated_at: string;
  donated_at: string | null;
  claimed_at: string | null;
  listing_title: string | null;
  listing_message: string | null;
  pickup_note: string | null;
  available_until: string | null;
  listed_at: string | null;
};

export type Collection = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type CollectionItem = {
  collection_id: string;
  item_id: string;
  added_at: string;
};

export type ScanResult = {
  category: ItemCategory;
  color?: string;
  material?: string;
  brand?: string;
  condition: ItemCondition;
  raw?: unknown;
};
