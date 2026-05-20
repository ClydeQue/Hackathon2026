import { useState } from 'react';
import {
  Alert,
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
import { DM_SERIF } from '@/lib/fonts';
import type { ItemStatus } from '@/types';

const MAX_BATCH = 30;

type Stage = 'intro' | 'pick' | 'swipe';

export default function Onboarding() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('intro');
  const [queue, setQueue] = useState<string[]>([]);

  async function finish() {
    // Stamp onboarded_at so the root layout stops routing us here. We
    // don't block navigation on the network call — best-effort.
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
    // If iOS won't re-prompt (canAskAgain is false), the only path forward
    // is the Settings app. Surface that explicitly instead of looping the
    // user back through a useless "try again" alert.
    Alert.alert(
      `${kind === 'camera' ? 'Camera' : 'Photo'} access denied`,
      `Enable ${kind} access for this app in Settings to continue.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
  }

  async function pickBatch() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      explainDenial('photos');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_BATCH,
      quality: 0.8,
    });
    if (result.canceled) return;
    setQueue((q) => [...q, ...result.assets.map((a) => a.uri)]);
  }

  async function pickOne(source: 'camera' | 'library') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      explainDenial(source === 'camera' ? 'camera' : 'photos');
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    setQueue((q) => [...q, result.assets[0].uri]);
  }

  function removeFromQueue(uri: string) {
    setQueue((q) => q.filter((u) => u !== uri));
  }

  // Fire-and-forget upload so swiping stays snappy. A failed upload is
  // logged but the user keeps moving — better UX than blocking on each.
  function handleSwipe(uri: string, status: ItemStatus) {
    createItemFromPickedPhoto({ uri, status }).catch((err) => {
      console.warn('[onboarding] upload failed for', uri, err?.message);
    });
  }

  // ---- Intro --------------------------------------------------------------
  if (stage === 'intro') {
    return (
      <SafeAreaView style={styles.introContainer} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView
          contentContainerStyle={styles.introScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introTagRow}>
            <View style={styles.introTag}>
              <Text style={styles.introTagText}>STEP 1 OF 2</Text>
              <Ionicons name="arrow-forward" size={11} color="#fff" />
            </View>
            <Pressable onPress={finish} hitSlop={12}>
              <Text style={styles.introSkip}>Skip</Text>
            </Pressable>
          </View>

          <Text style={styles.introHeadline}>
            Your closet's{'\n'}bigger than{' '}
            <Text style={styles.introHighlight}>you think</Text>.
          </Text>

          <Text style={styles.introBody}>
            Snap or import a few photos and we'll{' '}
            <Text style={styles.introUnderline}>auto-tag</Text> each piece. Then
            you'll swipe through your closet to mark what to{' '}
            <Text style={styles.introUnderline}>keep</Text> or{' '}
            <Text style={styles.introUnderline}>archive</Text>.
          </Text>

          <View style={[styles.quoteCard, { transform: [{ rotate: '-2deg' }] }]}>
            <Text style={styles.quoteText}>
              "Found 6 shirts I haven't touched in 2 years."
            </Text>
            <Text style={styles.quoteAuthor}>— ally, last week</Text>
          </View>

          <View style={[styles.stickyCard, { transform: [{ rotate: '1.5deg' }] }]}>
            <Text style={styles.stickyTitle}>WHAT YOU'LL NEED</Text>
            <View style={styles.stickyList}>
              <Text style={styles.stickyItem}>— your camera or library</Text>
              <Text style={styles.stickyItem}>— ~5 minutes</Text>
              <Text style={styles.stickyItem}>— closet door open</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.introCtaWrap}>
          <Pressable style={styles.introCta} onPress={() => setStage('pick')}>
            <Text style={styles.introCtaText}>OK, ADD PHOTOS</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'swipe') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.swipeHeader}>
          <Pressable onPress={finish} hitSlop={12}>
            <Text style={styles.skipText}>Done</Text>
          </Pressable>
          <Text style={styles.hint}>← Archive · Keep →</Text>
        </View>
        <ActionSwiperDeck
          cards={queue}
          renderCard={(uri) => (
            <View style={styles.card}>
              <Image
                source={{ uri }}
                style={styles.cardImage}
                contentFit="cover"
                transition={150}
              />
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Build your closet</Text>
          <Pressable onPress={finish} hitSlop={12}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          Add photos of your clothes. You'll swipe through them to mark each as{' '}
          <Text style={styles.kw}>keep</Text> or <Text style={styles.kw}>archive</Text>.
        </Text>

        <View style={styles.actions}>
          <Pressable style={styles.actionPrimary} onPress={pickBatch}>
            <Ionicons name="images-outline" size={22} color="#fff" />
            <Text style={styles.actionPrimaryText}>Pick from library</Text>
            <Text style={styles.actionPrimaryHint}>up to {MAX_BATCH} at once</Text>
          </Pressable>

          <View style={styles.row}>
            <Pressable style={styles.actionSecondary} onPress={() => pickOne('camera')}>
              <Ionicons name="camera-outline" size={20} color="#111" />
              <Text style={styles.actionSecondaryText}>Camera</Text>
            </Pressable>
            <Pressable style={styles.actionSecondary} onPress={() => pickOne('library')}>
              <Ionicons name="add-outline" size={20} color="#111" />
              <Text style={styles.actionSecondaryText}>One more</Text>
            </Pressable>
          </View>
        </View>

        {queue.length > 0 ? (
          <>
            <Text style={styles.queueLabel}>
              {queue.length} photo{queue.length === 1 ? '' : 's'} ready
            </Text>
            <View style={styles.grid}>
              {queue.map((uri) => (
                <View key={uri} style={styles.thumbWrap}>
                  <Image
                    source={{ uri }}
                    style={styles.thumb}
                    contentFit="cover"
                  />
                  <Pressable
                    style={styles.removeBadge}
                    hitSlop={8}
                    onPress={() => removeFromQueue(uri)}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.empty}>No photos yet. Pick some, or skip for now.</Text>
        )}
      </ScrollView>

      {queue.length > 0 ? (
        <View style={styles.footer}>
          <Pressable style={styles.startButton} onPress={() => setStage('swipe')}>
            <Text style={styles.startText}>Start swiping</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20, paddingBottom: 100, gap: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 28, fontWeight: '800' },
  skipText: { fontSize: 16, color: '#666', fontWeight: '600' },
  subtitle: { color: '#555', fontSize: 15, lineHeight: 22 },
  kw: { fontWeight: '700', color: '#111' },
  actions: { gap: 10, marginTop: 8 },
  actionPrimary: {
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    gap: 4,
  },
  actionPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  actionPrimaryHint: { color: '#aaa', fontSize: 12 },
  row: { flexDirection: 'row', gap: 10 },
  actionSecondary: {
    flex: 1,
    backgroundColor: '#f3f3f3',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  actionSecondaryText: { color: '#111', fontWeight: '600' },
  queueLabel: { marginTop: 16, fontWeight: '700', color: '#333' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 84, height: 84, borderRadius: 10, backgroundColor: '#eee' },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(17,17,17,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: { color: '#888', marginTop: 24, textAlign: 'center' },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  startButton: {
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  swipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  hint: { color: '#888', fontSize: 13 },
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

  // ---- Intro --------------------------------------------------------------
  introContainer: { flex: 1, backgroundColor: '#fdfaf2' },
  introScroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120 },

  introTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  introTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#d63a2f',
  },
  introTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  introSkip: { color: '#888', fontWeight: '600', fontSize: 14 },

  introHeadline: {
    fontFamily: DM_SERIF.regular,
    fontSize: 44,
    lineHeight: 48,
    color: '#111',
    marginBottom: 18,
  },
  introHighlight: {
    backgroundColor: '#ffe14a',
    color: '#111',
  },

  introBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
    marginBottom: 28,
  },
  introUnderline: {
    color: '#111',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  quoteCard: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#111',
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
    marginBottom: 22,
    alignSelf: 'flex-start',
    maxWidth: '88%',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 3, height: 4 },
    elevation: 3,
  },
  quoteText: { fontSize: 14, color: '#111', fontWeight: '600', lineHeight: 20 },
  quoteAuthor: { fontSize: 11, color: '#666', marginTop: 6, fontWeight: '500' },

  stickyCard: {
    backgroundColor: '#fff3a0',
    borderWidth: 1.5,
    borderColor: '#111',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    alignSelf: 'flex-end',
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 3, height: 4 },
    elevation: 3,
  },
  stickyTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#111',
    marginBottom: 8,
  },
  stickyList: { gap: 4 },
  stickyItem: { fontSize: 13, color: '#111', fontWeight: '500' },

  introCtaWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 32,
  },
  introCta: {
    backgroundColor: '#111',
    paddingVertical: 18,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  introCtaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
