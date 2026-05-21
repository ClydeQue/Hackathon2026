import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
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

const INK  = '#0F1117';
const CREAM = '#EEF4FB';
const PAPER = '#DCEAF6';
const LIME  = '#F4FF61';
const PINK  = '#2A6FDB';
const CYAN  = '#5BA3E8';

type Look = { pieces: ClothingItem[] };

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function lookKey(pieces: ClothingItem[]): string {
  return pieces.map((p) => p.id).sort().join('|');
}

function pickLook(items: ClothingItem[], previous: Look | null): Look | null {
  const byCat: Record<ItemCategory, ClothingItem[]> = {
    top: [], bottom: [], outerwear: [], dress: [], other: [],
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
    if (byCat.outerwear.length && Math.random() < 0.4) pieces.push(rand(byCat.outerwear));
    if (lookKey(pieces) !== previousKey) return { pieces };
  }
  if (canPair) return { pieces: [rand(byCat.top), rand(byCat.bottom)] };
  return { pieces: [rand(byCat.dress)] };
}

function Slot({ item, onPress }: { item: ClothingItem; onPress?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    signedPhotoUrl(item.photo_path).then((u) => { if (!cancelled) setUrl(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [item.photo_path]);
  return (
    <Pressable style={s.slot} onPress={onPress}>
      {url ? (
        <Image source={{ uri: url, cacheKey: item.photo_path }} style={s.img} contentFit="cover" transition={150} />
      ) : (
        <View style={[s.img, { backgroundColor: PAPER }]} />
      )}
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
  const lookAnim = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    let list: ClothingItem[] = [];
    if (collectionId) {
      const [colRes, joinRes] = await Promise.all([
        supabase.from('collections').select('*').eq('id', collectionId).single(),
        supabase.from('collection_items').select('archived_at, clothing_items(*)').eq('collection_id', collectionId).is('archived_at', null),
      ]);
      const col = colRes.data as Collection | null;
      setScopeName(col?.name ?? 'Collection');
      list = ((joinRes.data ?? []) as any[]).map((r) => r.clothing_items as ClothingItem | null).filter((it): it is ClothingItem => !!it);
    } else {
      setScopeName('All items');
      const { data } = await supabase.from('clothing_items').select('*').eq('owner_id', u.user.id).eq('status', 'keep');
      list = (data ?? []) as ClothingItem[];
    }
    setItems(list);
    setLook(pickLook(list, null));
    setLoading(false);
  }, [collectionId]);

  useEffect(() => { load(); }, [load]);

  function refresh() {
    Animated.sequence([
      Animated.timing(lookAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(lookAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setLook((prev) => pickLook(items, prev)), 100);
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* WearAble header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.eyebrow}>◎ {scopeName}</Text>
          <Text style={s.headerTitle}>
            Outfit{' '}
            <Text style={s.headerEm}>engine</Text>
          </Text>
        </View>
        <View style={s.headerActions}>
          <Pressable onPress={refresh} hitSlop={10} disabled={!look} style={s.headerBtn}>
            <Ionicons name="refresh" size={18} color={look ? INK : `${INK}44`} />
          </Pressable>
          <View style={s.claudeBadge}>
            <Text style={s.claudeText}>claude</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={s.center}><Spinner /></View>
      ) : !look ? (
        <View style={s.center}>
          <Text style={s.emptyTitle}>
            {items.length === 0 ? 'Nothing here yet.' : 'Not enough to mix.'}
          </Text>
          <Text style={s.emptyBody}>
            {items.length === 0
              ? collectionId ? 'This collection has no active items.' : 'Add some clothes to your closet first.'
              : 'An outfit needs either a top + bottom, or a dress.'}
          </Text>
          {items.length > 0 ? (
            <Text style={s.emptyCounts}>
              {(['top', 'bottom', 'dress', 'outerwear', 'other'] as ItemCategory[])
                .map((c) => `${items.filter((i) => i.category === c).length} ${c}`)
                .join(' · ')}
            </Text>
          ) : null}
        </View>
      ) : (
        <Animated.View style={[s.lookWrap, { opacity: lookAnim }]}>
          {look.pieces.map((piece) => (
            <Slot key={piece.id} item={piece} onPress={() => router.push(`/item/${piece.id}`)} />
          ))}
        </Animated.View>
      )}

      {look ? (
        <Pressable style={s.refreshBtn} onPress={refresh}>
          <Ionicons name="refresh" size={18} color={LIME} />
          <Text style={s.refreshText}>New combo</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM },

  // ── WearAble header ───────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 3, borderBottomColor: INK,
    backgroundColor: CREAM,
  },
  headerLeft: { flex: 1 },
  eyebrow: {
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 10, color: INK, opacity: 0.6,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 26, color: INK, letterSpacing: -0.3, marginTop: 2,
  },
  headerEm: {
    fontFamily: 'CherryBombOne-Regular',
    fontSize: 28, color: PINK,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 12 },
  headerBtn: {
    width: 38, height: 38,
    borderWidth: 3, borderColor: INK,
    backgroundColor: PAPER,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: INK, shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  claudeBadge: {
    paddingVertical: 4, paddingHorizontal: 8,
    backgroundColor: CYAN,
    borderWidth: 2, borderColor: INK,
    transform: [{ rotate: '-2deg' }],
  },
  claudeText: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 9, color: INK,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 22, color: INK, textAlign: 'center',
  },
  emptyBody: {
    color: INK, opacity: 0.6, marginTop: 8,
    textAlign: 'center', fontFamily: 'WorkSans',
    fontWeight: '500', fontSize: 14, lineHeight: 20,
  },
  emptyCounts: {
    marginTop: 16, color: INK, opacity: 0.5,
    fontSize: 12, textAlign: 'center',
    textTransform: 'uppercase', letterSpacing: 0.5,
    fontFamily: 'WorkSans', fontWeight: '700',
  },
  lookWrap: { flex: 1, padding: 14, gap: 12 },
  slot: {
    flex: 1,
    backgroundColor: PAPER,
    borderWidth: 3, borderColor: INK,
    overflow: 'hidden',
    shadowColor: INK, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  img: { width: '100%', height: '100%' },
  refreshBtn: {
    margin: 16,
    backgroundColor: INK,
    borderWidth: 3, borderColor: INK,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: INK, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  refreshText: {
    color: LIME, fontFamily: 'WorkSans',
    fontWeight: '900', textTransform: 'uppercase',
    letterSpacing: 0.8, fontSize: 13,
  },
});
