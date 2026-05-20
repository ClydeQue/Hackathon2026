export type ItemStatus = 'keep' | 'archive' | 'donate';

export type ItemCategory =
  | 'top'
  | 'bottom'
  | 'outerwear'
  | 'shoes'
  | 'accessory'
  | 'dress'
  | 'other';

export type SwipeDirection = 'left' | 'right';

export type Profile = {
  user_id: string;
  display_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_handle: string | null;
  avatar_url: string | null;
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
  ai_tags: Record<string, unknown> | null;
  status: ItemStatus;
  created_at: string;
  updated_at: string;
  donated_at: string | null;
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
  raw?: unknown;
};
