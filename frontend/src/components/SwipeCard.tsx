import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { signedPhotoUrl } from '@/lib/supabase';
import type { ClothingItem } from '@/types';

const INK   = '#0F1117';
const PAPER  = '#DCEAF6';
const LIME   = '#F4FF61';

type Props = {
  item: ClothingItem;
  donorName?: string;
};

function shortTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `${m}m ago`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return `${h}h ago`;
  }
  const d = Math.floor(diffSec / 86400);
  return `${d}d ago`;
}

export function SwipeCard({ item, donorName }: Props) {
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

  const tagsLine = useMemo(() => {
    return [item.category, item.condition, item.material]
      .filter((v): v is string => !!v)
      .map((v) => v.toLowerCase())
      .join(' · ');
  }, [item.category, item.condition, item.material]);

  const posted = useMemo(() => shortTime(item.listed_at), [item.listed_at]);

  const stickerLabel = useMemo(() => {
    return [item.category, item.size]
      .filter((v): v is string => !!v)
      .join(' · ');
  }, [item.category, item.size]);

  return (
    <View style={styles.card}>
      {/* Photo */}
      <View style={styles.imageWrap}>
        {url ? (
          <Image
            source={{ uri: url, cacheKey: item.photo_path }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.image, { backgroundColor: PAPER }]} />
        )}
      </View>

      {/* Info section */}
      <View style={styles.infoSection}>
        <View style={styles.infoLeft}>
          <Text style={styles.headline} numberOfLines={2}>{headline}</Text>
          {tagsLine ? (
            <Text style={styles.tagsLine} numberOfLines={1}>{tagsLine}</Text>
          ) : null}
          {donorName ? (
            <Text style={styles.donorRow} numberOfLines={1}>
              ◉ {donorName}{posted ? ` · ${posted}` : ''}
            </Text>
          ) : null}
        </View>
        {stickerLabel ? (
          <View style={styles.sticker}>
            <Text style={styles.stickerText}>{stickerLabel}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: INK,
    shadowColor: INK,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 6, height: 6 },
    elevation: 0,
  },
  imageWrap: { flex: 1 },
  image: { width: '100%', height: '100%' },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 14,
    gap: 10,
    borderTopWidth: 3,
    borderTopColor: INK,
    backgroundColor: '#fff',
  },
  infoLeft: { flex: 1 },
  headline: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 20, color: INK,
    letterSpacing: -0.3, textTransform: 'capitalize',
  },
  tagsLine: {
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 10, color: INK, opacity: 0.65,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginTop: 3,
  },
  donorRow: {
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 10, color: INK, opacity: 0.65,
    textTransform: 'uppercase', letterSpacing: 0.4,
    marginTop: 2,
  },
  sticker: {
    backgroundColor: LIME,
    borderWidth: 3, borderColor: INK,
    paddingVertical: 5, paddingHorizontal: 8,
    transform: [{ rotate: '4deg' }],
    shadowColor: INK, shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1, shadowRadius: 0,
    flexShrink: 0,
    alignSelf: 'flex-end',
  },
  stickerText: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 9, color: INK,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
});
