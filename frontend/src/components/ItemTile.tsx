import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { signedPhotoUrl } from '@/lib/supabase';
import type { ClothingItem } from '@/types';

type Props = {
  item: ClothingItem;
  onPress?: () => void;
};

export function ItemTile({ item, onPress }: Props) {
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

  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <View style={styles.imageBox}>
        {url ? <Image source={{ uri: url }} style={styles.image} /> : null}
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
  title: { marginTop: 6, fontWeight: '600', textTransform: 'capitalize' },
  meta: { color: '#777', fontSize: 12, textTransform: 'capitalize' },
});
