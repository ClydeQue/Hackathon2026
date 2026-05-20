import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { signedPhotoUrl } from '@/lib/supabase';
import type { ClothingItem } from '@/types';

type Props = {
  item: ClothingItem;
  onPress?: () => void;
  onRemove?: () => void;
};

export function ItemTile({ item, onPress, onRemove }: Props) {
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
    <Pressable style={styles.tile} onPress={onPress}>
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
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {item.brand ?? item.category}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {[item.color, item.category].filter(Boolean).join(' · ')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, margin: 6 },
  imageBox: {
    aspectRatio: 1,
    backgroundColor: '#eee',
    borderRadius: 14,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  errorText: { color: '#c00', fontSize: 11, padding: 8, textAlign: 'center' },
  removeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(17,17,17,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { marginTop: 6, fontWeight: '600', textTransform: 'capitalize' },
  meta: { color: '#777', fontSize: 12, textTransform: 'capitalize' },
});
