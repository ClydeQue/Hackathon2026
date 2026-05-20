import type { ClothingItem, ItemCategory } from '@/types';
import { isCompatible } from './colors';

export type Outfit = {
  id: string;
  items: ClothingItem[];
};

type Bucket = Record<ItemCategory, ClothingItem[]>;

function bucket(items: ClothingItem[]): Bucket {
  const empty: Bucket = {
    top: [],
    bottom: [],
    outerwear: [],
    shoes: [],
    accessory: [],
    dress: [],
    other: [],
  };
  for (const item of items) empty[item.category].push(item);
  return empty;
}

function pick<T>(arr: T[]): T | null {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
}

function compatibleAll(items: ClothingItem[]): boolean {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (!isCompatible(items[i].color, items[j].color)) return false;
    }
  }
  return true;
}

function outfitKey(items: ClothingItem[]): string {
  return items
    .map((i) => i.id)
    .sort()
    .join('|');
}

export function recommendOutfits(items: ClothingItem[], count = 5): Outfit[] {
  // Recommender only considers items the user is keeping.
  const wearable = items.filter((i) => i.status === 'keep');
  const b = bucket(wearable);

  const out: Outfit[] = [];
  const seen = new Set<string>();
  const maxTries = count * 10;

  for (let attempt = 0; attempt < maxTries && out.length < count; attempt++) {
    const useDress = b.dress.length > 0 && Math.random() < 0.4;
    const core: ClothingItem[] = [];

    if (useDress) {
      const d = pick(b.dress);
      if (d) core.push(d);
    } else {
      const top = pick(b.top);
      const bottom = pick(b.bottom);
      if (top) core.push(top);
      if (bottom) core.push(bottom);
    }

    if (core.length === 0) continue;

    if (b.outerwear.length && Math.random() < 0.5) {
      const o = pick(b.outerwear);
      if (o) core.push(o);
    }
    if (b.shoes.length && Math.random() < 0.7) {
      const s = pick(b.shoes);
      if (s) core.push(s);
    }
    if (b.accessory.length && Math.random() < 0.3) {
      const a = pick(b.accessory);
      if (a) core.push(a);
    }

    if (!compatibleAll(core)) continue;

    const key = outfitKey(core);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ id: key, items: core });
  }

  return out;
}
