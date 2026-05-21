import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ActionSwiperDeck } from '@/components/ActionSwiperDeck';
import { createItemFromPickedPhoto } from '@/lib/items';
import { supabase } from '@/lib/supabase';
import type { ItemStatus } from '@/types';

const INK   = '#0F1117';
const CREAM = '#EEF4FB';
const PAPER = '#DCEAF6';
const LIME  = '#F4FF61';
const PINK  = '#2A6FDB';
const CORAL = '#FF5C4D';
const CYAN  = '#5BA3E8';
const SUN   = '#FFAE2D';

type Stage = 'splash' | 'problem' | 'loops' | 'pick' | 'swipe';
const MAX_BATCH = 30;

const LOOPS = [
  { num: '01', title: 'SORT',  bg: CYAN, desc: 'Photograph each piece, swipe right to keep, left to part ways.' },
  { num: '02', title: 'GIVE',  bg: LIME, desc: 'Archived items appear in a local feed. First swipe wins.' },
  { num: '03', title: 'STYLE', bg: SUN,  desc: 'Claude builds outfits from what you already own. Nothing new to buy.' },
];

const CONFETTI_COLORS = [PINK, LIME, CYAN, SUN, CORAL, PAPER];
const CONFETTI = (() => {
  let seed = 7;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  return Array.from({ length: 18 }, () => ({
    x: rand() * 420 - 30,
    y: rand() * 900 - 30,
    w: 14 + rand() * 30,
    h: 20 + rand() * 44,
    rot: (rand() - 0.5) * 70,
    color: CONFETTI_COLORS[Math.floor(rand() * CONFETTI_COLORS.length)],
  }));
})();

function PressBtn({
  children, style, onPress, disabled,
}: { children: React.ReactNode; style?: any; onPress?: () => void; disabled?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };
  return (
    <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={onPress} disabled={disabled}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('splash');
  const [queue, setQueue] = useState<string[]>([]);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (stage !== 'splash') return;
    const t = setTimeout(() => transition('problem'), 2400);
    return () => clearTimeout(t);
  }, [stage]);

  function transition(next: Stage) {
    Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: true, easing: Easing.out(Easing.ease) }).start(() => {
      setStage(next);
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true, easing: Easing.in(Easing.ease) }).start();
    });
  }

  async function finish() {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      supabase
        .from('profiles')
        .update({ onboarded_at: new Date().toISOString() })
        .eq('user_id', u.user.id)
        .then(({ error }) => {
          if (error) console.warn('[onboarding] mark onboarded failed', error.message);
        });
    }
    router.replace('/(tabs)');
  }

  function explainDenial(kind: 'camera' | 'photos') {
    Alert.alert(
      `${kind === 'camera' ? 'Camera' : 'Photo'} access denied`,
      `Enable ${kind} access for this app in Settings to continue.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }],
    );
  }

  async function pickBatch() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { explainDenial('photos'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true,
      selectionLimit: MAX_BATCH, quality: 0.8,
    });
    if (result.canceled) return;
    setQueue((q) => [...q, ...result.assets.map((a) => a.uri)]);
  }

  async function pickOne(source: 'camera' | 'library') {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { explainDenial(source === 'camera' ? 'camera' : 'photos'); return; }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    setQueue((q) => [...q, result.assets[0].uri]);
  }

  function removeFromQueue(uri: string) {
    setQueue((q) => q.filter((u) => u !== uri));
  }

  function handleSwipe(uri: string, status: ItemStatus) {
    createItemFromPickedPhoto({ uri, status }).catch((err) => {
      console.warn('[onboarding] upload failed for', uri, err?.message);
    });
  }

  // ── Swipe stage ──────────────────────────────────────────────────────────
  if (stage === 'swipe') {
    return (
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.swipeHeader}>
          <Pressable onPress={finish} hitSlop={12}>
            <Text style={s.crumb}>Done</Text>
          </Pressable>
          <Text style={s.hint}>← Archive · Keep →</Text>
        </View>
        <ActionSwiperDeck
          cards={queue}
          renderCard={(uri) => (
            <View style={s.card}>
              <Image source={{ uri }} style={s.cardImage} contentFit="cover" transition={150} />
            </View>
          )}
          onSwipeRight={(uri) => handleSwipe(uri, 'keep')}
          onSwipeLeft={(uri) => handleSwipe(uri, 'archive')}
          onAllDone={finish}
          rightLabel="KEEP"
          leftLabel="ARCHIVE"
        />
      </SafeAreaView>
    );
  }

  return (
    <Animated.View style={{ flex: 1, opacity: fade }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── SPLASH ───────────────────────────────────────── */}
      {stage === 'splash' && (
        <Pressable style={s.splash} onPress={() => transition('problem')}>
          {/* confetti */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {CONFETTI.map((c, i) => (
              <View key={i} style={{
                position: 'absolute', left: c.x, top: c.y,
                width: c.w, height: c.h,
                backgroundColor: c.color,
                borderWidth: 2, borderColor: INK,
                opacity: 0.16,
                transform: [{ rotate: `${c.rot}deg` }],
              }} />
            ))}
          </View>

          <SafeAreaView style={s.splashSafe} edges={['top', 'bottom']}>
            <View style={s.splashContent}>
              <View style={s.stickerYellow}>
                <Text style={s.stickerText}>◉ SDG · 12</Text>
              </View>
              <View style={{ marginTop: 18 }}>
                <Text style={s.splashWear}>Wear</Text>
                <View style={s.splashAbleWrap}>
                  <Text style={s.splashAble}>Able.</Text>
                </View>
              </View>
              <Text style={s.splashTagline}>wear what you already own.</Text>
            </View>
            <Text style={s.splashTapHint}>▼ tap to start · auto in 2s</Text>
          </SafeAreaView>
        </Pressable>
      )}

      {/* ── PROBLEM ──────────────────────────────────────── */}
      {stage === 'problem' && (
        <SafeAreaView style={s.step} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={[s.sticker, { backgroundColor: CORAL, transform: [{ rotate: '-4deg' }] }]}>
              <Text style={s.stickerText}>● the bad news</Text>
            </View>

            <Text style={s.headline}>
              {'Fast fashion\nwastes '}
              <Text style={[s.em, { fontSize: 58, backgroundColor: SUN, paddingHorizontal: 4 }]}>92M</Text>
              {'\ntonnes a yr.'}
            </Text>

            <Text style={s.body}>
              Most of your closet sits unworn. Most of what gets donated gets{' '}
              <Text style={{ textDecorationLine: 'underline' }}>downcycled</Text> anyway.
              The friction is the problem.
            </Text>

            <View style={{ marginTop: 8, gap: 14 }}>
              <View style={[s.quoteCard, { transform: [{ rotate: '-2deg' }], alignSelf: 'flex-start', maxWidth: '65%' }]}>
                <View style={[s.quoteTag, { backgroundColor: PINK }]}>
                  <Text style={[s.stickerText, { color: CREAM, fontSize: 8 }]}>worn 1×</Text>
                </View>
                <Text style={s.quoteText}>"Bought, wore once, forgot."</Text>
                <Text style={s.quoteMeta}>avg. garment · 7–10 wears</Text>
              </View>
              <View style={[s.quoteCard, { backgroundColor: LIME, transform: [{ rotate: '3deg' }], alignSelf: 'flex-end', maxWidth: '62%' }]}>
                <View style={[s.quoteTag, { backgroundColor: CYAN, right: -6, left: undefined }]}>
                  <Text style={[s.stickerText, { fontSize: 8 }]}>fix me</Text>
                </View>
                <Text style={s.quoteText}>What if sorting was fun?</Text>
                <Text style={s.quoteMeta}>← swipe = give · → swipe = keep</Text>
              </View>
            </View>
          </ScrollView>
          <View style={s.floatCta}>
            <PressBtn style={s.ctaInk} onPress={() => transition('loops')}>
              <Text style={s.ctaText}>ok, show me how →</Text>
            </PressBtn>
          </View>
        </SafeAreaView>
      )}

      {/* ── LOOPS ────────────────────────────────────────── */}
      {stage === 'loops' && (
        <SafeAreaView style={s.step} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={[s.sticker, { backgroundColor: LIME, transform: [{ rotate: '-4deg' }] }]}>
              <Text style={s.stickerText}>▷ how it works</Text>
            </View>
            <Text style={s.headline}>
              <Text style={s.em}>Three</Text>{'\n'}simple{'\n'}loops.
            </Text>

            {LOOPS.map((l, i) => (
              <View key={l.num} style={[s.loopCard, { backgroundColor: l.bg, transform: [{ rotate: `${i % 2 ? 1 : -1}deg` }] }]}>
                <Text style={s.loopNum}>{l.num}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.loopTitle}>{l.title}</Text>
                  <Text style={s.loopDesc}>{l.desc}</Text>
                </View>
              </View>
            ))}

            <Text style={s.loopNote}>no logistics. no shipping. just your neighbour.</Text>
          </ScrollView>
          <View style={s.floatCta}>
            <PressBtn style={[s.ctaInk, { backgroundColor: PINK }]} onPress={() => transition('pick')}>
              <Text style={s.ctaText}>I'm in →</Text>
            </PressBtn>
          </View>
        </SafeAreaView>
      )}

      {/* ── PICK ─────────────────────────────────────────── */}
      {stage === 'pick' && (
        <SafeAreaView style={s.step} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.pickTopRow}>
              <View style={[s.sticker, { backgroundColor: queue.length > 0 ? LIME : SUN, transform: [{ rotate: '-3deg' }] }]}>
                <Text style={s.stickerText}>{queue.length} added</Text>
              </View>
              <Pressable onPress={finish} hitSlop={12}>
                <Text style={s.crumb}>skip</Text>
              </Pressable>
            </View>

            <Text style={s.headline}>
              {'Build your\n'}
              <Text style={s.em}>closet.</Text>
            </Text>
            <Text style={s.body}>
              Snap or import photos. We'll auto-tag each piece — just review and confirm.
            </Text>

            <PressBtn style={s.actionPrimary} onPress={pickBatch}>
              <Ionicons name="images-outline" size={22} color={LIME} />
              <Text style={s.actionPrimaryText}>Pick from library</Text>
              <Text style={s.actionPrimaryHint}>up to {MAX_BATCH} at once</Text>
            </PressBtn>

            <View style={s.actionRow}>
              <PressBtn style={s.actionSecondary} onPress={() => pickOne('camera')}>
                <Ionicons name="camera-outline" size={20} color={INK} />
                <Text style={s.actionSecondaryText}>Camera</Text>
              </PressBtn>
              <PressBtn style={s.actionSecondary} onPress={() => pickOne('library')}>
                <Ionicons name="add-outline" size={20} color={INK} />
                <Text style={s.actionSecondaryText}>One more</Text>
              </PressBtn>
            </View>

            {queue.length > 0 ? (
              <>
                <Text style={s.queueLabel}>
                  {queue.length} photo{queue.length === 1 ? '' : 's'} ready
                </Text>
                <View style={s.grid}>
                  {queue.map((uri) => (
                    <View key={uri} style={s.thumbWrap}>
                      <Image source={{ uri }} style={s.thumb} contentFit="cover" />
                      <Pressable style={s.removeBadge} hitSlop={8} onPress={() => removeFromQueue(uri)}>
                        <Ionicons name="close" size={14} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={s.empty}>No photos yet. Add some, or skip for now.</Text>
            )}
          </ScrollView>

          {queue.length > 0 && (
            <View style={s.floatCta}>
              <PressBtn style={s.ctaInk} onPress={() => transition('swipe')}>
                <Text style={s.ctaText}>Start sorting →</Text>
              </PressBtn>
            </View>
          )}
        </SafeAreaView>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM },
  step: { flex: 1, backgroundColor: CREAM },
  scroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 130, gap: 16 },

  // Splash
  splash: { flex: 1, backgroundColor: INK },
  splashSafe: { flex: 1 },
  splashContent: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },
  stickerYellow: {
    alignSelf: 'flex-start',
    backgroundColor: LIME,
    borderWidth: 3, borderColor: INK,
    paddingHorizontal: 10, paddingVertical: 5,
    shadowColor: INK, shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1, shadowRadius: 0,
    transform: [{ rotate: '-6deg' }],
  },
  splashWear: {
    fontFamily: 'CherryBombOne-Regular',
    fontSize: 92, lineHeight: 82,
    color: CREAM,
  },
  splashAbleWrap: {
    alignSelf: 'flex-start',
    backgroundColor: PINK,
    paddingHorizontal: 14,
    transform: [{ skewX: '-4deg' }],
  },
  splashAble: {
    fontFamily: 'CherryBombOne-Regular',
    fontSize: 92, lineHeight: 82,
    color: CREAM,
  },
  splashTagline: {
    marginTop: 22,
    fontFamily: 'WorkSans',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: CREAM,
    opacity: 0.75,
  },
  splashTapHint: {
    textAlign: 'center',
    paddingBottom: 40,
    fontFamily: 'WorkSans',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: CREAM,
    opacity: 0.5,
  },

  // Shared primitives
  sticker: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 3, borderColor: INK,
    shadowColor: INK, shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  stickerText: {
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: INK,
  },
  headline: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 46, lineHeight: 46,
    color: INK, letterSpacing: -1.2,
  },
  em: {
    fontFamily: 'CherryBombOne-Regular',
    color: PINK,
    fontSize: 52,
  },
  body: {
    fontFamily: 'WorkSans', fontWeight: '500',
    fontSize: 14.5, lineHeight: 21,
    color: INK, opacity: 0.75,
  },

  // Problem
  quoteCard: {
    backgroundColor: CREAM,
    borderWidth: 3, borderColor: INK,
    padding: 14,
    shadowColor: INK, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
    position: 'relative',
  },
  quoteTag: {
    position: 'absolute', top: -8, left: -6,
    paddingHorizontal: 6, paddingVertical: 3,
    borderWidth: 2, borderColor: INK,
    transform: [{ rotate: '-6deg' }],
  },
  quoteText: {
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 13, lineHeight: 19, color: INK, marginTop: 6,
  },
  quoteMeta: {
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 9, textTransform: 'uppercase',
    letterSpacing: 0.8, opacity: 0.6, color: INK, marginTop: 6,
  },

  // Loops
  loopCard: {
    borderWidth: 3, borderColor: INK,
    padding: 14,
    shadowColor: INK, shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1, shadowRadius: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  loopNum: {
    fontFamily: 'CherryBombOne-Regular',
    fontSize: 36, color: INK, minWidth: 54,
  },
  loopTitle: {
    fontFamily: 'CherryBombOne-Regular',
    fontSize: 22, color: INK, lineHeight: 24,
  },
  loopDesc: {
    fontFamily: 'WorkSans', fontWeight: '500',
    fontSize: 12, lineHeight: 17, color: INK,
    marginTop: 2, opacity: 0.8,
  },
  loopNote: {
    textAlign: 'center',
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 10, textTransform: 'uppercase',
    letterSpacing: 1.2, color: INK, opacity: 0.5,
  },

  // Pick
  pickTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionPrimary: {
    backgroundColor: INK,
    borderWidth: 3, borderColor: INK,
    padding: 18, alignItems: 'center', gap: 4,
    shadowColor: INK, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  actionPrimaryText: {
    color: LIME, fontSize: 14, fontWeight: '900',
    textTransform: 'uppercase', letterSpacing: 0.8,
    fontFamily: 'WorkSans',
  },
  actionPrimaryHint: {
    color: LIME, opacity: 0.6, fontSize: 12,
    fontFamily: 'WorkSans',
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionSecondary: {
    flex: 1,
    backgroundColor: PAPER,
    borderWidth: 3, borderColor: INK,
    padding: 14, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    shadowColor: INK, shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  actionSecondaryText: {
    color: INK, fontWeight: '800',
    textTransform: 'uppercase', fontSize: 12,
    letterSpacing: 0.5, fontFamily: 'WorkSans',
  },
  queueLabel: {
    fontFamily: 'WorkSans', fontWeight: '900',
    color: INK, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 84, height: 84,
    backgroundColor: PAPER,
    borderWidth: 3, borderColor: INK,
  },
  removeBadge: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22,
    backgroundColor: CORAL,
    borderWidth: 2, borderColor: INK,
    justifyContent: 'center', alignItems: 'center',
  },
  empty: {
    color: INK, opacity: 0.5, textAlign: 'center',
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // CTA
  floatCta: { position: 'absolute', left: 24, right: 24, bottom: 36 },
  ctaInk: {
    backgroundColor: INK,
    borderWidth: 3, borderColor: INK,
    paddingVertical: 18, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    shadowColor: INK, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  ctaText: {
    color: LIME, fontSize: 14, fontWeight: '900',
    letterSpacing: 1.2, textTransform: 'uppercase',
    fontFamily: 'WorkSans',
  },

  // Swipe stage
  swipeHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  crumb: {
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.8, color: INK, opacity: 0.6,
  },
  hint: {
    color: INK, opacity: 0.6, fontSize: 12,
    fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, fontFamily: 'WorkSans',
  },
  card: {
    flex: 1, backgroundColor: PAPER,
    borderWidth: 3, borderColor: INK,
    overflow: 'hidden',
    shadowColor: INK, shadowOpacity: 1,
    shadowRadius: 0, shadowOffset: { width: 6, height: 6 }, elevation: 0,
  },
  cardImage: { flex: 1, backgroundColor: '#C8DBF0' },
});
