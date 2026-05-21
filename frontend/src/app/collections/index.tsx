import { useCallback, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Spinner } from '@/components/Spinner';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import type { Collection } from '@/types';

const INK   = '#0F1117';
const CREAM  = '#EEF4FB';
const PAPER  = '#DCEAF6';
const LIME   = '#F4FF61';
const SMOKE  = '#C8DBF0';
const PINK   = '#2A6FDB';
const SUN    = '#FFAE2D';
const CYAN   = '#5BA3E8';

type CollectionWithCount = Collection & { item_count: number };

export default function CollectionsList() {
  const router = useRouter();
  const [items, setItems] = useState<CollectionWithCount[] | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from('collections')
      .select('*, collection_items(count)')
      .eq('owner_id', u.user.id)
      .order('created_at', { ascending: false });
    if (error) { console.warn('[collections] load failed', error.message); setItems([]); return; }
    const mapped: CollectionWithCount[] = (data ?? []).map((row: any) => ({
      ...row, item_count: row.collection_items?.[0]?.count ?? 0,
    }));
    setItems(mapped);
    Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* WearAble header */}
      <View style={s.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={INK} />
        </Pressable>
        <Text style={s.headerTitle}>
          Collec-<Text style={s.headerEm}>tions</Text>
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {items === null ? (
        <Spinner style={{ marginTop: 24 }} />
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}>
            <Ionicons name="albums-outline" size={28} color={INK} />
          </View>
          <Text style={s.emptyTitle}>No collections yet.</Text>
          <Text style={s.emptyBody}>Group items for a season, an event, or a vibe.</Text>
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <FlatList
            data={items}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
            renderItem={({ item, index }) => (
              <Pressable
                style={[s.row, { transform: [{ rotate: `${index % 2 === 0 ? -0.4 : 0.4}deg` }] }]}
                onPress={() => router.push(`/collections/${item.id}`)}
              >
                <View style={s.rowIcon}>
                  <Ionicons name="albums-outline" size={18} color={INK} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.rowMeta}>
                    {item.item_count} item{item.item_count === 1 ? '' : 's'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={`${INK}55`} />
              </Pressable>
            )}
          />
        </Animated.View>
      )}

      <Pressable style={s.fab} onPress={() => router.push('/collections/new')}>
        <Ionicons name="add" size={22} color={LIME} />
        <Text style={s.fabText}>New collection</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14,
    borderBottomWidth: 3, borderBottomColor: INK,
    backgroundColor: CREAM,
  },
  headerTitle: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 22, color: INK, letterSpacing: -0.3,
  },
  headerEm: {
    fontFamily: 'CherryBombOne-Regular',
    fontSize: 24, color: PINK,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  emptyIcon: {
    width: 52, height: 52,
    backgroundColor: PAPER,
    borderWidth: 3, borderColor: INK,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: INK, shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  emptyTitle: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 20, color: INK,
  },
  emptyBody: {
    color: INK, opacity: 0.6, textAlign: 'center',
    fontFamily: 'WorkSans', fontWeight: '500', fontSize: 14, lineHeight: 20,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: PAPER,
    borderWidth: 3, borderColor: INK,
    shadowColor: INK, shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  rowIcon: {
    width: 36, height: 36,
    backgroundColor: CREAM,
    borderWidth: 2, borderColor: INK,
    justifyContent: 'center', alignItems: 'center',
  },
  rowName: {
    fontFamily: 'WorkSans', fontWeight: '800',
    fontSize: 15, color: INK,
  },
  rowMeta: {
    fontFamily: 'WorkSans', fontWeight: '700',
    color: INK, opacity: 0.55, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 1,
  },
  fab: {
    position: 'absolute', right: 16, bottom: 16,
    paddingVertical: 14, paddingHorizontal: 18,
    backgroundColor: INK,
    borderWidth: 3, borderColor: INK,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    shadowColor: INK, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  fabText: {
    color: LIME, fontFamily: 'WorkSans',
    fontWeight: '900', textTransform: 'uppercase',
    letterSpacing: 0.6, fontSize: 12,
  },
});
