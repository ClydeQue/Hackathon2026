import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Spinner } from '@/components/Spinner';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Swiper from 'react-native-deck-swiper';
import { SwipeCard } from '@/components/SwipeCard';
import { supabase } from '@/lib/supabase';
import type { ClothingItem, SwipeDirection } from '@/types';

const INK   = '#0F1117';
const CREAM  = '#EEF4FB';
const LIME   = '#F4FF61';
const CORAL  = '#FF5C4D';
const PINK   = '#2A6FDB';

type DiscoverItem = ClothingItem & { donor_name: string };

const STAMP_THRESHOLD = 100;
const MAX_CARD_HEIGHT = 640;
const MIN_CARD_HEIGHT = 320;
// approximate heights of header and action-button row (used in card height calc)
const HEADER_H  = 92;
const BUTTONS_H = 80;

export default function Discover() {
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const dragX = useRef(new Animated.Value(0)).current;
  const swiperRef = useRef<any>(null);
  const tabBarHeight = useBottomTabBarHeight();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const cardHeight = Math.max(
    MIN_CARD_HEIGHT,
    Math.min(
      MAX_CARD_HEIGHT,
      windowHeight - insets.top - tabBarHeight - HEADER_H - BUTTONS_H - 12,
    ),
  );

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    const { data: swipes } = await supabase
      .from('swipes')
      .select('item_id')
      .eq('swiper_id', u.user.id);
    const excluded = (swipes ?? []).map((s) => s.item_id);

    let query = supabase
      .from('clothing_items')
      .select('*')
      .eq('status', 'donate')
      .not('listed_at', 'is', null)
      .is('claimed_at', null)
      .neq('owner_id', u.user.id)
      .order('listed_at', { ascending: false })
      .limit(30);

    if (excluded.length > 0) {
      query = query.not('id', 'in', `(${excluded.join(',')})`);
    }

    const { data: itemRows, error } = await query;
    if (error) {
      Alert.alert('Discover error', error.message);
      setLoading(false);
      return;
    }
    const rows = (itemRows ?? []) as ClothingItem[];

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

    const mapped: DiscoverItem[] = rows.map((row) => ({
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

  async function recordSwipe(item: DiscoverItem | undefined, direction: SwipeDirection) {
    if (!item) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
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

  async function refreshDeck() {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      const { error } = await supabase
        .from('swipes')
        .delete()
        .eq('swiper_id', u.user.id);
      if (error) console.warn('[discover] clear swipes failed', error.message);
    }
    setExhausted(false);
    load();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Spinner />
      </View>
    );
  }

  if (exhausted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>You've seen everything.</Text>
          <Text style={styles.emptyBody}>Check back later for new donations.</Text>
          <Pressable style={styles.refreshBtn} onPress={refreshDeck}>
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
    outputRange: [0.6, 1],
    extrapolate: 'clamp',
  });
  const nopeOpacity = dragX.interpolate({
    inputRange: [-STAMP_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const nopeScale = dragX.interpolate({
    inputRange: [-STAMP_THRESHOLD, 0],
    outputRange: [1, 0.6],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* WearAble header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>
            Nearby{'\n'}
            <Text style={styles.headerEm}>giveaways</Text>
          </Text>
          <Text style={styles.eyebrow}>◉ Browse donations near you</Text>
        </View>
        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>● live</Text>
        </View>
      </View>

      {/* Deck area */}
      <View style={styles.deckOuter}>
        <View style={[styles.deckSlot, { height: cardHeight }]}>
          <Swiper
            ref={swiperRef}
            cards={items}
            backgroundColor="transparent"
            stackSize={3}
            cardVerticalMargin={0}
            cardStyle={{ top: 0, height: cardHeight }}
            renderCard={(card: DiscoverItem) =>
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

          {/* PASS sticker — fades in when dragging left */}
          <Animated.View
            pointerEvents="none"
            style={[styles.passLayer, { opacity: nopeOpacity }]}
          >
            <Animated.View
              style={[
                styles.passSticker,
                { transform: [{ scale: nopeScale }, { rotate: '-14deg' }] },
              ]}
            >
              <Text style={styles.passText}>← PASS</Text>
            </Animated.View>
          </Animated.View>

          {/* CLAIM sticker — fades in when dragging right */}
          <Animated.View
            pointerEvents="none"
            style={[styles.claimLayer, { opacity: yesOpacity }]}
          >
            <Animated.View
              style={[
                styles.claimSticker,
                { transform: [{ scale: yesScale }, { rotate: '14deg' }] },
              ]}
            >
              <Text style={styles.claimText}>CLAIM →</Text>
            </Animated.View>
          </Animated.View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={[styles.actionRow, { paddingBottom: tabBarHeight + 6 }]}>
        <Pressable
          style={styles.btnPass}
          onPress={() => swiperRef.current?.swipeLeft()}
        >
          <Text style={styles.btnPassText}>✕</Text>
        </Pressable>
        <Pressable
          style={styles.btnClaim}
          onPress={() => swiperRef.current?.swipeRight()}
        >
          <Text style={styles.btnClaimText}>♥</Text>
        </Pressable>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10,
    borderBottomWidth: 3, borderBottomColor: INK,
    backgroundColor: CREAM,
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 26, color: INK, lineHeight: 28,
  },
  headerEm: {
    fontFamily: 'CherryBombOne-Regular',
    fontSize: 28, color: PINK,
  },
  eyebrow: {
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 10, color: INK, opacity: 0.65,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 5,
  },
  liveBadge: {
    backgroundColor: LIME,
    borderWidth: 3, borderColor: INK,
    paddingVertical: 5, paddingHorizontal: 9,
    transform: [{ rotate: '6deg' }],
    shadowColor: INK, shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1, shadowRadius: 0,
    marginTop: 4,
  },
  liveText: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 9, color: INK,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // ── Deck ────────────────────────────────────────────────────────────────
  deckOuter: { flex: 1, paddingHorizontal: 14, paddingTop: 8 },
  deckSlot: { position: 'relative' },

  // ── Sticker overlays ────────────────────────────────────────────────────
  passLayer: {
    position: 'absolute', top: 18, left: 6,
    zIndex: 999, elevation: 20,
  },
  passSticker: {
    backgroundColor: INK,
    borderWidth: 3, borderColor: CORAL,
    paddingVertical: 7, paddingHorizontal: 14,
  },
  passText: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 18, color: CORAL, letterSpacing: 0.5,
  },
  claimLayer: {
    position: 'absolute', top: 18, right: 6,
    zIndex: 999, elevation: 20,
  },
  claimSticker: {
    backgroundColor: LIME,
    borderWidth: 3, borderColor: INK,
    paddingVertical: 7, paddingHorizontal: 14,
  },
  claimText: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 18, color: INK, letterSpacing: 0.5,
  },

  // ── Action buttons ──────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 20, paddingTop: 12,
  },
  btnPass: {
    width: 56, height: 56,
    backgroundColor: CREAM,
    borderWidth: 3, borderColor: INK,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: INK, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  btnPassText: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 22, color: CORAL,
  },
  btnClaim: {
    width: 56, height: 56,
    backgroundColor: LIME,
    borderWidth: 3, borderColor: INK,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: INK, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  btnClaimText: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 22, color: INK,
  },

  // ── Empty state ─────────────────────────────────────────────────────────
  emptyTitle: {
    fontFamily: 'WorkSans', fontSize: 22, fontWeight: '900',
    color: INK, letterSpacing: -0.3,
  },
  emptyBody: {
    color: INK, opacity: 0.6, marginTop: 6,
    fontFamily: 'WorkSans', fontWeight: '600',
  },
  refreshBtn: {
    marginTop: 20, paddingVertical: 14, paddingHorizontal: 24,
    backgroundColor: INK,
    borderWidth: 3, borderColor: INK,
    shadowColor: INK, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  refreshText: {
    color: LIME, fontFamily: 'WorkSans',
    fontWeight: '900', textTransform: 'uppercase',
    letterSpacing: 0.8, fontSize: 13,
  },
});
