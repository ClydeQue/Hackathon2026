import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DM_SERIF } from '@/lib/fonts';
import { signedPhotoUrl } from '@/lib/supabase';
import type { ClothingItem } from '@/types';

type Props = {
  item: ClothingItem;
  donorName?: string;
};

function pretty(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/_/g, ' ').trim();
}

function capitalize(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function relativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 45) return 'Posted just now';
  if (diffSec < 60 * 60) {
    const m = Math.max(1, Math.floor(diffSec / 60));
    return `Posted ${m} minute${m === 1 ? '' : 's'} ago`;
  }
  if (diffSec < 60 * 60 * 24) {
    const h = Math.floor(diffSec / 3600);
    return `Posted ${h} hour${h === 1 ? '' : 's'} ago`;
  }
  if (diffSec < 60 * 60 * 24 * 7) {
    const d = Math.floor(diffSec / 86400);
    return d === 1 ? 'Posted yesterday' : `Posted ${d} days ago`;
  }
  return `Posted ${new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;
}

export function SwipeCard({ item, donorName }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    signedPhotoUrl(item.photo_path)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [item.photo_path]);

  // Top line: `[color] [material] [category]` — lowercase, missing fields
  // dropped. Falls back to the listing title or brand if nothing categorical
  // is set so the card never shows a blank header.
  const headline = useMemo(() => {
    const parts = [item.color, item.material, item.category]
      .map((v) => v?.toString().trim())
      .filter((v): v is string => !!v);
    if (parts.length > 0) return parts.join(' ').toLowerCase();
    return (
      item.listing_title?.trim() ||
      item.brand?.trim() ||
      'donation'
    ).toLowerCase();
  }, [item.color, item.material, item.category, item.listing_title, item.brand]);

  // Bottom meta line: `[condition] • [size] • [sex]`. Each piece capitalised
  // for readability; missing fields are dropped so we never render a hollow
  // bullet pair like "• Xl •".
  const metaLine = useMemo(() => {
    return [capitalize(pretty(item.condition)), capitalize(item.size), capitalize(item.gender)]
      .filter((v): v is string => !!v)
      .join(' • ');
  }, [item.condition, item.size, item.gender]);

  const postedAt = useMemo(() => relativeTime(item.listed_at), [item.listed_at]);

  return (
    <View style={styles.card}>
      {url ? (
        <Image
          source={{ uri: url, cacheKey: item.photo_path }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={styles.imageFallback} />
      )}

      {postedAt ? (
        <View style={styles.topTag} pointerEvents="none">
          <Ionicons name="time-outline" size={11} color="#000" />
          <Text style={styles.topTagText}>{postedAt}</Text>
        </View>
      ) : null}

      <View style={styles.bottom}>
        <Text style={styles.headline} numberOfLines={1}>
          {headline}
        </Text>
        {metaLine ? (
          <Text style={styles.meta} numberOfLines={1}>
            {metaLine}
          </Text>
        ) : null}

        {donorName ? (
          <Pressable
            style={styles.locationRow}
            onPress={() => router.push(`/donor/${item.id}`)}
            hitSlop={6}
          >
            <Ionicons name="location-outline" size={14} color="#fff" />
            <Text style={styles.locationText} numberOfLines={1}>
              {donorName}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color="rgba(255,255,255,0.85)"
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 6, height: 6 },
    elevation: 0,
  },
  image: { width: '100%', height: '100%' },
  imageFallback: {
    position: 'absolute',
    inset: 0 as unknown as number,
    backgroundColor: '#333',
  },
  topTag: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: '#FFE66D',
    borderWidth: 2,
    borderColor: '#000',
  },
  topTagText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingBottom: 22,
    paddingTop: 26,
    gap: 6,
  },
  headline: {
    color: '#fff',
    fontFamily: DM_SERIF.regular,
    fontSize: 30,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  meta: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
