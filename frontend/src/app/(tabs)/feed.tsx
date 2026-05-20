import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Swiper from 'react-native-deck-swiper';
import { SwipeCard } from '@/components/SwipeCard';
import { supabase } from '@/lib/supabase';
import type { ClothingItem, SwipeDirection } from '@/types';

type FeedItem = ClothingItem & { donor_name: string };

// Drag distance (px) at which the YES/NOPE stamp reaches full opacity/scale.
const STAMP_THRESHOLD = 120;

// Card height in px. react-native-deck-swiper sizes from Dimensions.get('window')
// and ignores the parent container, so we override via the Swiper's cardStyle.
const CARD_HEIGHT = 750;

export default function Feed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const dragX = useRef(new Animated.Value(0)).current;
  const tabBarHeight = useBottomTabBarHeight();

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

  function springStampBack() {
    Animated.spring(dragX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 90,
      friction: 8,
    }).start();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  async function refreshDeck() {
    // Dev-only convenience: clear our own swipe history so already-seen
    // donations reappear. Other users' decks are untouched.
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      const { error } = await supabase
        .from('swipes')
        .delete()
        .eq('swiper_id', u.user.id);
      if (error) console.warn('[feed] clear swipes failed', error.message);
    }
    setExhausted(false);
    load();
  }

  if (exhausted) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>You’ve seen everything.</Text>
          <Text style={styles.emptyBody}>Check back later for new donations.</Text>
          <Pressable style={styles.refresh} onPress={refreshDeck}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const yesOpacity = dragX.interpolate({
    inputRange: [0, STAMP_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const yesScale = dragX.interpolate({
    inputRange: [0, STAMP_THRESHOLD],
    outputRange: [0.4, 1],
    extrapolate: 'clamp',
  });
  const nopeOpacity = dragX.interpolate({
    inputRange: [-STAMP_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const nopeScale = dragX.interpolate({
    inputRange: [-STAMP_THRESHOLD, 0],
    outputRange: [1, 0.4],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={[styles.deckWrap, { paddingBottom: tabBarHeight }]}>
        <View style={styles.deckSlot}>
          <Swiper
            cards={items}
            backgroundColor="transparent"
            stackSize={3}
            cardVerticalMargin={0}
            cardStyle={{ top: 0, height: CARD_HEIGHT }}
            renderCard={(card: FeedItem) =>
              card ? <SwipeCard item={card} donorName={card.donor_name} /> : null
            }
            onSwiping={(x: number) => dragX.setValue(x)}
            onSwipedAborted={springStampBack}
            onSwipedRight={(i: number) => {
              springStampBack();
              recordSwipe(items[i], 'right');
            }}
            onSwipedLeft={(i: number) => {
              springStampBack();
              recordSwipe(items[i], 'left');
            }}
            onSwipedAll={() => setExhausted(true)}
            disableTopSwipe
            disableBottomSwipe
            verticalSwipe={false}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.stampLayer, { opacity: yesOpacity }]}
          >
            <Animated.View
              style={[
                styles.stampBox,
                styles.stampYesBox,
                { transform: [{ scale: yesScale }, { rotate: '-18deg' }] },
              ]}
            >
              <Text style={[styles.stampText, styles.stampYesText]}>YES</Text>
            </Animated.View>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[styles.stampLayer, { opacity: nopeOpacity }]}
          >
            <Animated.View
              style={[
                styles.stampBox,
                styles.stampNopeBox,
                { transform: [{ scale: nopeScale }, { rotate: '18deg' }] },
              ]}
            >
              <Text style={[styles.stampText, styles.stampNopeText]}>NOPE</Text>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
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
  // Card slot is pinned to the top of the deckWrap with a hard ceiling on
  // height so the card stays short rather than stretching to fill the screen.
  deckSlot: { flex: 1, maxHeight: CARD_HEIGHT },
  // Fills the deckSlot so the YES/NOPE stamp centers on the card, not on the
  // empty space below it. elevation/zIndex keep it above the deck on both
  // iOS (zIndex) and Android (elevation).
  stampLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 20,
  },
  stampBox: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderWidth: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  stampYesBox: { borderColor: '#0a8' },
  stampNopeBox: { borderColor: '#c0392b' },
  stampText: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 3,
  },
  stampYesText: { color: '#0a8' },
  stampNopeText: { color: '#c0392b' },
});
