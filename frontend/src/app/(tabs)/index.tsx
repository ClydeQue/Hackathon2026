import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ItemTile } from '@/components/ItemTile';
import { supabase } from '@/lib/supabase';
import type { ClothingItem, ItemStatus } from '@/types';

const FILTERS: ItemStatus[] = ['keep', 'archive', 'donate'];

export default function Catalogue() {
  const [filter, setFilter] = useState<ItemStatus>('keep');
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    const { data: session } = await supabase.auth.getUser();
    if (!session.user) return;
    const { data, error } = await supabase
      .from('clothing_items')
      .select('*')
      .eq('owner_id', session.user.id)
      .eq('status', filter)
      .order('created_at', { ascending: false });
    if (!error && data) setItems(data as ClothingItem[]);
    setLoading(false);
    setRefreshing(false);
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filter, filter === f && styles.filterActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.outfitButton}
        onPress={() => router.push('/outfit')}
      >
        <Ionicons name="sparkles-outline" size={16} color="#111" />
        <Text style={styles.outfitButtonText}>Suggest an outfit</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>
          Nothing in “{filter}” yet. Tap Add to start your catalogue.
        </Text>
      ) : (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 6 }}
          renderItem={({ item }) => (
            <ItemTile item={item} onPress={() => router.push(`/item/${item.id}`)} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  filterRow: { flexDirection: 'row', padding: 12, gap: 8 },
  filter: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#eee',
  },
  filterActive: { backgroundColor: '#111' },
  filterText: { color: '#333', textTransform: 'capitalize' },
  filterTextActive: { color: '#fff' },
  outfitButton: {
    marginHorizontal: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f6f1ea',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  outfitButtonText: { fontWeight: '600' },
  empty: { textAlign: 'center', color: '#777', marginTop: 48, paddingHorizontal: 24 },
});
