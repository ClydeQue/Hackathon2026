import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Swiper from 'react-native-deck-swiper';
import { SwipeCard } from '@/components/SwipeCard';
import { supabase } from '@/lib/supabase';
import type { ClothingItem, SwipeDirection } from '@/types';

type FeedItem = ClothingItem & { donor_name: string };

export default function Feed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    // Fetch already-swiped item ids so we can exclude them.
    const { data: swipes } = await supabase
      .from('swipes')
      .select('item_id')
      .eq('swiper_id', u.user.id);
    const excluded = (swipes ?? []).map((s) => s.item_id);

    let query = supabase
      .from('clothing_items')
      .select('*')
      .eq('status', 'donate')
      .neq('owner_id', u.user.id)
      .order('donated_at', { ascending: false })
      .limit(30);

    if (excluded.length > 0) {
      query = query.not('id', 'in', `(${excluded.join(',')})`);
    }

    const { data: itemRows, error } = await query;
    if (error) {
      Alert.alert('Feed error', error.message);
      setLoading(false);
      return;
    }
    const rows = (itemRows ?? []) as ClothingItem[];

    // Donor display_name in one batched profile lookup.
    const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id)));
    const nameById = new Map<string, string>();
    if (ownerIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('user_id,display_name')
        .in('user_id', ownerIds);
      for (const p of profileRows ?? []) {
        nameById.set((p as any).user_id, (p as any).display_name);
      }
    }

    const mapped: FeedItem[] = rows.map((row) => ({
      ...row,
      donor_name: nameById.get(row.owner_id) ?? 'Someone',
    }));
    setItems(mapped);
    setExhausted(mapped.length === 0);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function recordSwipe(item: FeedItem | undefined, direction: SwipeDirection) {
    // react-native-deck-swiper sometimes fires onSwiped* with stale / out-of-
    // range indices when the deck is empty or being torn down — guard before
    // touching item.id.
    if (!item) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    // Idempotent thanks to the unique(swiper_id, item_id) constraint.
    const { error } = await supabase
      .from('swipes')
      .insert({ swiper_id: u.user.id, item_id: item.id, direction });
    if (error && !error.message.includes('duplicate')) {
      console.warn('swipe insert failed', error.message);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (exhausted) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>You’ve seen everything.</Text>
          <Text style={styles.emptyBody}>Check back later for new donations.</Text>
          <Pressable style={styles.refresh} onPress={load}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.deckWrap}>
        <Swiper
          cards={items}
          backgroundColor="transparent"
          stackSize={3}
          cardVerticalMargin={20}
          renderCard={(card: FeedItem) =>
            card ? <SwipeCard item={card} donorName={card.donor_name} /> : null
          }
          onSwipedRight={(i: number) => recordSwipe(items[i], 'right')}
          onSwipedLeft={(i: number) => recordSwipe(items[i], 'left')}
          onSwipedAll={() => setExhausted(true)}
          disableTopSwipe
          disableBottomSwipe
          overlayLabels={{
            left: {
              title: 'NOPE',
              style: { label: styles.labelLeft, wrapper: styles.labelLeftWrap },
            },
            right: {
              title: 'WANT',
              style: { label: styles.labelRight, wrapper: styles.labelRightWrap },
            },
          }}
        />
      </View>
      <Text style={styles.hint}>Swipe right to add to your cart.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyBody: { color: '#666', marginTop: 6 },
  refresh: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#111',
    borderRadius: 12,
  },
  refreshText: { color: '#fff', fontWeight: '600' },
  deckWrap: { flex: 1 },
  hint: { textAlign: 'center', color: '#888', paddingBottom: 16 },
  labelLeft: { color: '#a00', fontSize: 32, fontWeight: '800' },
  labelLeftWrap: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    marginTop: 40,
    marginLeft: -20,
  },
  labelRight: { color: '#0a8', fontSize: 32, fontWeight: '800' },
  labelRightWrap: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    marginTop: 40,
    marginLeft: 20,
  },
});
