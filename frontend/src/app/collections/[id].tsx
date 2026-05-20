import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ActionSwiperDeck } from '@/components/ActionSwiperDeck';
import { ItemTile } from '@/components/ItemTile';
import {
  invalidateSignedPhotoUrl,
  signedPhotoUrl,
  STORAGE_BUCKET,
  supabase,
} from '@/lib/supabase';
import type { ClothingItem, Collection } from '@/types';

type Stage = 'view' | 'add';

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

export default function CollectionDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [stage, setStage] = useState<Stage>('view');
  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [candidates, setCandidates] = useState<ClothingItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    const { data: col, error: colErr } = await supabase
      .from('collections')
      .select('*')
      .eq('id', id)
      .single();
    if (colErr) {
      Alert.alert('Couldn\'t load collection', colErr.message);
      router.back();
      return;
    }
    setCollection(col as Collection);

    const { data: rows } = await supabase
      .from('collection_items')
      .select('item_id, clothing_items(*)')
      .eq('collection_id', id);
    const itemsInColl = ((rows ?? []) as any[])
      .map((r) => r.clothing_items as ClothingItem)
      .filter(Boolean);
    setItems(itemsInColl);
    setLoading(false);
  }, [id, router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function startAdd() {
    if (!id) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const inCollIds = new Set(items.map((i) => i.id));
    const { data, error } = await supabase
      .from('clothing_items')
      .select('*')
      .eq('owner_id', u.user.id)
      .order('created_at', { ascending: false });
    if (error) {
      Alert.alert('Couldn\'t load items', error.message);
      return;
    }
    const remaining = ((data ?? []) as ClothingItem[]).filter((i) => !inCollIds.has(i.id));
    if (remaining.length === 0) {
      Alert.alert('Nothing new', 'Every item is already in this collection.');
      return;
    }
    setCandidates(remaining);
    setStage('add');
  }

  function addItem(item: ClothingItem) {
    if (!id) return;
    supabase
      .from('collection_items')
      .insert({ collection_id: id, item_id: item.id })
      .then(({ error }) => {
        if (error && !error.message.toLowerCase().includes('duplicate')) {
          console.warn('[collections] add failed', error.message);
        }
      });
  }

  function removeItem(item: ClothingItem) {
    if (!id) return;
    Alert.alert(
      item.brand ?? item.category,
      'Remove from this collection only, or delete the item from your closet entirely?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove from collection',
          onPress: async () => {
            await supabase
              .from('collection_items')
              .delete()
              .eq('collection_id', id)
              .eq('item_id', item.id);
            setItems((cur) => cur.filter((i) => i.id !== item.id));
          },
        },
        {
          text: 'Delete item',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('clothing_items')
              .delete()
              .eq('id', item.id);
            if (error) {
              Alert.alert('Delete failed', error.message);
              return;
            }
            // collection_items rows cascade with the clothing_items row.
            supabase.storage
              .from(STORAGE_BUCKET)
              .remove([item.photo_path])
              .catch(() => {});
            invalidateSignedPhotoUrl(item.photo_path);
            setItems((cur) => cur.filter((i) => i.id !== item.id));
          },
        },
      ],
    );
  }

  function deleteCollection() {
    if (!collection) return;
    Alert.alert(
      'Delete collection?',
      `"${collection.name}" will be removed. Items themselves are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('collections').delete().eq('id', collection.id);
            router.replace('/collections');
          },
        },
      ],
    );
  }

  if (loading || !collection) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (stage === 'add' && candidates) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              setStage('view');
              setCandidates(null);
              load();
            }}
            hitSlop={12}
          >
            <Text style={styles.cancelText}>Done</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {collection.name}
          </Text>
          <View style={{ width: 60 }} />
        </View>
        <Text style={styles.hint}>← Skip · Add →</Text>
        <ActionSwiperDeck
          cards={candidates}
          renderCard={(item) => <ItemCard item={item} />}
          onSwipeRight={addItem}
          onSwipeLeft={() => {}}
          onAllDone={() => {
            setStage('view');
            setCandidates(null);
            load();
          }}
          rightLabel="ADD"
          leftLabel="SKIP"
          leftColor="#888"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {collection.name}
        </Text>
        <Pressable onPress={deleteCollection} hitSlop={12}>
          <Ionicons name="trash-outline" size={22} color="#a00" />
        </Pressable>
      </View>

      <Text style={styles.subhead}>
        {items.length} item{items.length === 1 ? '' : 's'}
      </Text>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Empty collection.</Text>
          <Text style={styles.emptyBody}>Tap "Add items" to start filling it.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 6, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <ItemTile
              item={item}
              onPress={() => router.push(`/item/${item.id}`)}
              onRemove={() => removeItem(item)}
            />
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={startAdd}>
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.fabText}>Add items</Text>
      </Pressable>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  cancelText: { color: '#666', fontWeight: '600', fontSize: 15, width: 60 },
  subhead: { color: '#666', paddingHorizontal: 16, paddingBottom: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyBody: { color: '#666', marginTop: 6, textAlign: 'center' },
  hint: { textAlign: 'center', color: '#888', fontSize: 13, paddingVertical: 6 },
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
