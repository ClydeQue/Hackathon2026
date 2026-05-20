import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ItemTile } from '@/components/ItemTile';
import { recommendOutfits, type Outfit } from '@/lib/recommender';
import { supabase } from '@/lib/supabase';
import type { ClothingItem } from '@/types';

export default function OutfitScreen() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [closetSize, setClosetSize] = useState(0);

  const generate = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase
      .from('clothing_items')
      .select('*')
      .eq('owner_id', u.user.id)
      .eq('status', 'keep');
    const items = (data ?? []) as ClothingItem[];
    setClosetSize(items.length);
    setOutfits(recommendOutfits(items, 6));
    setLoading(false);
  }, []);

  useEffect(() => {
    generate();
  }, [generate]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'Outfit ideas' }} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : outfits.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Not enough to mix yet.</Text>
          <Text style={styles.emptyBody}>
            {closetSize === 0
              ? 'Add some items to your closet first.'
              : 'Try adding a top + bottom (or a dress) in “keep”.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={outfits}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item: outfit, index }) => (
            <View style={styles.outfit}>
              <Text style={styles.outfitLabel}>Look #{index + 1}</Text>
              <FlatList
                data={outfit.items}
                numColumns={2}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => <ItemTile item={item} />}
                scrollEnabled={false}
              />
            </View>
          )}
        />
      )}

      <Pressable style={styles.shuffle} onPress={generate}>
        <Text style={styles.shuffleText}>🔀 Shuffle</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyBody: { color: '#666', marginTop: 6, textAlign: 'center' },
  outfit: { marginBottom: 18 },
  outfitLabel: { fontWeight: '700', fontSize: 16, paddingHorizontal: 6, marginBottom: 6 },
  shuffle: {
    margin: 16,
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  shuffleText: { color: '#fff', fontWeight: '600' },
});
