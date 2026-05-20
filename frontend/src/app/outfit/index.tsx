import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Spinner } from '@/components/Spinner';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signedPhotoUrl, supabase } from '@/lib/supabase';
import type { ClothingItem, Collection, ItemCategory } from '@/types';

// A look is either a top+bottom pair or a single dress. Outerwear can ride
// on either when available.
type Look = {
  pieces: ClothingItem[];
};

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function lookKey(pieces: ClothingItem[]): string {
  return pieces.map((p) => p.id).sort().join('|');
}

function pickLook(items: ClothingItem[], previous: Look | null): Look | null {
  const byCat: Record<ItemCategory, ClothingItem[]> = {
    top: [],
    bottom: [],
    outerwear: [],
    dress: [],
    other: [],
  };
  for (const it of items) byCat[it.category]?.push(it);

  const canPair = byCat.top.length > 0 && byCat.bottom.length > 0;
  const canDress = byCat.dress.length > 0;
  if (!canPair && !canDress) return null;

  const previousKey = previous ? lookKey(previous.pieces) : null;

  for (let attempt = 0; attempt < 12; attempt++) {
    const useDress = canDress && (!canPair || Math.random() < 0.4);
    const pieces: ClothingItem[] = useDress
      ? [rand(byCat.dress)]
      : [rand(byCat.top), rand(byCat.bottom)];

    if (byCat.outerwear.length && Math.random() < 0.4) {
      pieces.push(rand(byCat.outerwear));
    }

    if (lookKey(pieces) !== previousKey) return { pieces };
  }

  // Couldn't find a fresh combo — return whatever fits.
  if (canPair) return { pieces: [rand(byCat.top), rand(byCat.bottom)] };
  return { pieces: [rand(byCat.dress)] };
}

function Slot({ item, onPress }: { item: ClothingItem; onPress?: () => void }) {
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
    <Pressable style={styles.slot} onPress={onPress}>
      {url ? (
        <Image
          source={{ uri: url, cacheKey: item.photo_path }}
          style={styles.img}
          contentFit="cover"
          transition={150}
        />
      ) : null}
    </Pressable>
  );
}

export default function OutfitScreen() {
  const router = useRouter();
  const { collection: collectionId } = useLocalSearchParams<{ collection?: string }>();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [look, setLook] = useState<Look | null>(null);
  const [loading, setLoading] = useState(true);
  const [scopeName, setScopeName] = useState<string>('All items');

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    let list: ClothingItem[] = [];

    if (collectionId) {
      // Pull the collection name (for the header) and its active items in
      // parallel. Items already archived inside the collection are excluded.
      const [colRes, joinRes] = await Promise.all([
        supabase.from('collections').select('*').eq('id', collectionId).single(),
        supabase
          .from('collection_items')
          .select('archived_at, clothing_items(*)')
          .eq('collection_id', collectionId)
          .is('archived_at', null),
      ]);
      const col = colRes.data as Collection | null;
      setScopeName(col?.name ?? 'Collection');
      // Inside a collection we trust the collection's own archived_at filter
      // (applied at the DB level above). An item's global closet status
      // (archive/donate) doesn't disqualify it from a curated collection.
      list = ((joinRes.data ?? []) as any[])
        .map((r) => r.clothing_items as ClothingItem | null)
        .filter((it): it is ClothingItem => !!it);
    } else {
      setScopeName('All items');
      const { data } = await supabase
        .from('clothing_items')
        .select('*')
        .eq('owner_id', u.user.id)
        .eq('status', 'keep');
      list = (data ?? []) as ClothingItem[];
    }

    const breakdown = list.reduce<Record<string, number>>((acc, it) => {
      acc[it.category] = (acc[it.category] ?? 0) + 1;
      return acc;
    }, {});
    console.log('[outfit] loaded', {
      scope: collectionId ? `collection:${collectionId}` : 'all',
      total: list.length,
      byCategory: breakdown,
    });

    setItems(list);
    setLook(pickLook(list, null));
    setLoading(false);
  }, [collectionId]);

  useEffect(() => {
    load();
  }, [load]);

  function refresh() {
    setLook((prev) => pickLook(items, prev));
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `Outfit · ${scopeName}`,
          headerRight: () => (
            <Pressable onPress={refresh} hitSlop={10} disabled={!look}>
              <Ionicons
                name="refresh"
                size={22}
                color={look ? '#111' : '#bbb'}
              />
            </Pressable>
          ),
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <Spinner />
        </View>
      ) : !look ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>
            {items.length === 0
              ? 'Nothing here yet.'
              : 'Not enough to mix.'}
          </Text>
          <Text style={styles.emptyBody}>
            {items.length === 0
              ? collectionId
                ? 'This collection has no active items.'
                : 'Add some clothes to your closet first.'
              : 'An outfit needs either a top + bottom, or a dress.'}
          </Text>
          {items.length > 0 ? (
            <Text style={styles.emptyCounts}>
              {(['top', 'bottom', 'dress', 'outerwear', 'other'] as ItemCategory[])
                .map((c) => `${items.filter((i) => i.category === c).length} ${c}`)
                .join(' · ')}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.lookWrap}>
          {look.pieces.map((piece) => (
            <Slot
              key={piece.id}
              item={piece}
              onPress={() => router.push(`/item/${piece.id}`)}
            />
          ))}
        </View>
      )}

      {look ? (
        <Pressable style={styles.refresh} onPress={refresh}>
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.refreshText}>New combo</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyBody: { color: '#666', marginTop: 6, textAlign: 'center' },
  emptyCounts: {
    marginTop: 14,
    color: '#444',
    fontSize: 13,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  lookWrap: { flex: 1, padding: 16, gap: 12 },
  slot: {
    flex: 1,
    backgroundColor: '#eee',
    borderRadius: 16,
    overflow: 'hidden',
  },
  img: { width: '100%', height: '100%' },
  refresh: {
    margin: 16,
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  refreshText: { color: '#fff', fontWeight: '600' },
});
