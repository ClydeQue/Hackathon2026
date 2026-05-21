import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { signedPhotoUrl } from '@/lib/supabase';
import type { ClothingItem } from '@/types';

type Props = {
  item: ClothingItem;
  onPress?: () => void;
  onLongPress?: () => void;
  onRemove?: () => void;
  // Optional translucent badge that overlays the bottom of the image, e.g.
  // "Archived" inside a collection's archive shelf.
  badge?: string | null;
  // Hide the brand / category / color labels under the image — useful when
  // the surrounding card already conveys the item's identity (Box outgoing
  // rows show the photo + status pill, the labels were redundant).
  imageOnly?: boolean;
};

export function ItemTile({
  item,
  onPress,
  onLongPress,
  onRemove,
  badge,
  imageOnly,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    signedPhotoUrl(item.photo_path)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.message ?? String(err);
        console.warn(`[ItemTile] signed URL failed for ${item.photo_path}:`, msg);
        setError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [item.photo_path]);

  return (
    <Pressable style={styles.tile} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.imageBox}>
        {url ? (
          <Image
            source={{ uri: url, cacheKey: item.photo_path }}
            style={styles.image}
            contentFit="cover"
            transition={150}
            onError={(e) => {
              const msg = e?.error ?? 'image failed to load';
              console.warn(`[ItemTile] image load failed for ${item.photo_path}:`, msg);
              setError(msg);
            }}
          />
        ) : error ? (
          <Text style={styles.errorText} numberOfLines={3}>
            {error}
          </Text>
        ) : null}
        {onRemove ? (
          <Pressable
            style={styles.removeBadge}
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <Ionicons name="close" size={16} color="#fff" />
          </Pressable>
        ) : null}
        {badge ? (
          <View style={styles.cornerBadge}>
            <Text style={styles.cornerBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {imageOnly ? null : (
        <>
          <Text style={styles.title} numberOfLines={1}>
            {item.brand ?? item.category}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[item.color, item.category].filter(Boolean).join(' · ')}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, margin: 6 },
  imageBox: {
    aspectRatio: 1,
    backgroundColor: '#DCEAF6',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#0F1117',
    shadowColor: '#0F1117',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  image: { width: '100%', height: '100%' },
  errorText: { color: '#FF5C4D', fontSize: 10, padding: 8, textAlign: 'center', fontWeight: '700' },
  removeBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 26,
    height: 26,
    backgroundColor: '#FF5C4D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0F1117',
  },
  title: {
    marginTop: 8,
    fontWeight: '900',
    color: '#0F1117',
    textTransform: 'capitalize',
    letterSpacing: 0.1,
    fontSize: 13,
  },
  meta: {
    color: '#0F1117',
    opacity: 0.6,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cornerBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#F4FF61',
    borderWidth: 2,
    borderColor: '#0F1117',
    shadowColor: '#0F1117',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  cornerBadgeText: {
    color: '#0F1117',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
