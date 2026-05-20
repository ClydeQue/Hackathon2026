import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import type { Collection } from '@/types';

type CollectionWithCount = Collection & { item_count: number };

export default function CollectionsList() {
  const router = useRouter();
  const [items, setItems] = useState<CollectionWithCount[] | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from('collections')
      .select('*, collection_items(count)')
      .eq('owner_id', u.user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[collections] load failed', error.message);
      setItems([]);
      return;
    }
    const mapped: CollectionWithCount[] = (data ?? []).map((row: any) => ({
      ...row,
      item_count: row.collection_items?.[0]?.count ?? 0,
    }));
    setItems(mapped);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle}>Collections</Text>
        <View style={{ width: 26 }} />
      </View>

      {items === null ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No collections yet.</Text>
          <Text style={styles.emptyBody}>
            Group items for a season, an event, or a vibe.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/collections/${item.id}`)}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="albums-outline" size={20} color="#111" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowMeta}>
                  {item.item_count} item{item.item_count === 1 ? '' : 's'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#bbb" />
            </Pressable>
          )}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/collections/new')}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.fabText}>New collection</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyBody: { color: '#666', marginTop: 6, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3f3f3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowName: { fontSize: 16, fontWeight: '600' },
  rowMeta: { color: '#888', fontSize: 13, marginTop: 2 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: '#111',
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700' },
});
