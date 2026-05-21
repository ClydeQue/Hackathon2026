import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Spinner } from '@/components/Spinner';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionSwiperDeck } from '@/components/ActionSwiperDeck';
import { signedPhotoUrl, supabase } from '@/lib/supabase';
import type { ClothingItem, ItemStatus } from '@/types';

const INK   = '#0F1117';
const CREAM  = '#EEF4FB';
const PAPER  = '#DCEAF6';
const LIME   = '#F4FF61';
const SMOKE  = '#C8DBF0';

function ItemCard({ item }: { item: ClothingItem }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    signedPhotoUrl(item.photo_path).then((u) => { if (!cancelled) setUrl(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [item.photo_path]);
  return (
    <View style={s.card}>
      {url ? (
        <Image source={{ uri: url, cacheKey: item.photo_path }} style={s.cardImage} contentFit="cover" transition={150} />
      ) : (
        <View style={[s.cardImage, { backgroundColor: PAPER }]} />
      )}
      <View style={s.cardMeta}>
        <Text style={s.cardTitle} numberOfLines={1}>{item.brand ?? item.category}</Text>
        <Text style={s.cardSub} numberOfLines={1}>
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
      .from('clothing_items').select('*')
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

  useEffect(() => { load(); }, [load]);

  async function updateStatus(item: ClothingItem, status: ItemStatus) {
    if (item.status === status) return;
    const { error } = await supabase.from('clothing_items').update({ status }).eq('id', item.id);
    if (error) console.warn('[reset] status update failed', error.message);
  }

  if (items === null) {
    return <View style={s.center}><Spinner /></View>;
  }

  const back = () => router.canGoBack() ? router.back() : router.replace('/(tabs)');

  if (items.length === 0) {
    return (
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.center}>
          <Text style={s.emptyTitle}>Nothing to re-sort.</Text>
          <Text style={s.emptyBody}>Add a few items first, then come back.</Text>
          <Pressable style={s.backBtn} onPress={back}>
            <Text style={s.backBtnText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.header}>
        <Pressable onPress={back} hitSlop={12}>
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={s.headerTitle}>Re-sort closet</Text>
        <Pressable onPress={back} hitSlop={12}>
          <Text style={s.doneText}>Done</Text>
        </Pressable>
      </View>
      <Text style={s.hint}>← Archive · Keep →</Text>
      <ActionSwiperDeck
        cards={items}
        renderCard={(item) => <ItemCard item={item} />}
        onSwipeRight={(item) => updateStatus(item, 'keep')}
        onSwipeLeft={(item) => updateStatus(item, 'archive')}
        onAllDone={back}
        rightLabel="KEEP"
        leftLabel="ARCHIVE"
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6,
  },
  headerTitle: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 15, color: INK,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  cancelText: {
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 12, textTransform: 'uppercase',
    letterSpacing: 0.6, color: INK, opacity: 0.55,
  },
  doneText: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 12, textTransform: 'uppercase',
    letterSpacing: 0.6, color: INK,
  },
  hint: {
    textAlign: 'center', color: INK, opacity: 0.5,
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.6, paddingVertical: 6,
  },
  emptyTitle: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 22, color: INK, textAlign: 'center',
  },
  emptyBody: {
    color: INK, opacity: 0.6, marginTop: 8,
    fontFamily: 'WorkSans', fontWeight: '500',
    fontSize: 14, textAlign: 'center',
  },
  backBtn: {
    marginTop: 20,
    backgroundColor: INK,
    borderWidth: 3, borderColor: INK,
    paddingVertical: 14, paddingHorizontal: 24,
    shadowColor: INK, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  backBtnText: {
    color: LIME, fontFamily: 'WorkSans',
    fontWeight: '900', textTransform: 'uppercase',
    letterSpacing: 0.8, fontSize: 13,
  },
  card: {
    flex: 1, backgroundColor: PAPER,
    borderWidth: 3, borderColor: INK,
    overflow: 'hidden',
    shadowColor: INK, shadowOpacity: 1,
    shadowRadius: 0, shadowOffset: { width: 6, height: 6 }, elevation: 0,
  },
  cardImage: { flex: 1 },
  cardMeta: {
    padding: 14,
    borderTopWidth: 2, borderTopColor: INK,
    backgroundColor: CREAM,
  },
  cardTitle: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 18, color: INK, textTransform: 'capitalize',
  },
  cardSub: {
    color: INK, opacity: 0.6,
    fontFamily: 'WorkSans', fontWeight: '600',
    fontSize: 12, marginTop: 4,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
});
