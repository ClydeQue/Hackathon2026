import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionSwiperDeck } from '@/components/ActionSwiperDeck';
import { signedPhotoUrl, supabase } from '@/lib/supabase';
import type { ClothingItem, ItemStatus } from '@/types';

function ItemCard({ item }: { item: ClothingItem }) {
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
      {url ? (
        <Image
          source={{ uri: url, cacheKey: item.photo_path }}
          style={styles.cardImage}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={styles.cardImage} />
      )}
      <View style={styles.cardMeta}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.brand ?? item.category}
        </Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {[item.color, item.category, item.material].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );
}

export default function ClosetReset() {
  const router = useRouter();
  const [items, setItems] = useState<ClothingItem[] | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from('clothing_items')
      .select('*')
      .eq('owner_id', u.user.id)
      .in('status', ['keep', 'archive'])
      .order('created_at', { ascending: false });
    if (error) {
      Alert.alert('Couldn\'t load items', error.message);
      router.back();
      return;
    }
    setItems((data ?? []) as ClothingItem[]);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(item: ClothingItem, status: ItemStatus) {
    if (item.status === status) return;
    const { error } = await supabase
      .from('clothing_items')
      .update({ status })
      .eq('id', item.id);
    if (error) console.warn('[reset] status update failed', error.message);
  }

  if (items === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Nothing to re-sort.</Text>
          <Text style={styles.emptyBody}>Add a few items first, then come back.</Text>
          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Re-sort closet</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.doneInlineText}>Done</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>← Archive · Keep →</Text>
      <ActionSwiperDeck
        cards={items}
        renderCard={(item) => <ItemCard item={item} />}
        onSwipeRight={(item) => updateStatus(item, 'keep')}
        onSwipeLeft={(item) => updateStatus(item, 'archive')}
        onAllDone={() => router.back()}
        rightLabel="KEEP"
        leftLabel="ARCHIVE"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  cancelText: { color: '#666', fontWeight: '600', fontSize: 15 },
  doneInlineText: { color: '#111', fontWeight: '700', fontSize: 15 },
  hint: { textAlign: 'center', color: '#888', fontSize: 13, paddingVertical: 6 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyBody: { color: '#666', marginTop: 6 },
  doneBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#111',
    borderRadius: 12,
  },
  doneText: { color: '#fff', fontWeight: '600' },
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
  cardImage: { flex: 1, backgroundColor: '#eee' },
  cardMeta: { padding: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', textTransform: 'capitalize' },
  cardSub: { color: '#666', marginTop: 4, textTransform: 'capitalize' },
});
