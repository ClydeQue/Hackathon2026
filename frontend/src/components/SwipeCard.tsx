import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { signedPhotoUrl } from '@/lib/supabase';
import type { ClothingItem } from '@/types';

type Props = {
  item: ClothingItem;
  donorName?: string;
};

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

  return (
    <View style={styles.card}>
      <View style={styles.imageBox}>
        {url ? <Image source={{ uri: url }} style={styles.image} /> : null}
      </View>
      <View style={styles.meta}>
        <Text style={styles.title}>
          {item.brand ?? item.category}
        </Text>
        <Text style={styles.sub}>
          {[item.color, item.category, item.material].filter(Boolean).join(' · ')}
        </Text>
        {donorName ? <Text style={styles.donor}>from {donorName}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  imageBox: { flex: 1, backgroundColor: '#eee' },
  image: { width: '100%', height: '100%' },
  meta: { padding: 18 },
  title: { fontSize: 22, fontWeight: '700', textTransform: 'capitalize' },
  sub: { color: '#555', marginTop: 4, textTransform: 'capitalize' },
  donor: { color: '#888', marginTop: 8, fontStyle: 'italic' },
});
