import { useState } from 'react';
import {
  Alert,
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

const MAX_BATCH = 30;

type Stage = 'pick' | 'swipe';

export default function Onboarding() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('pick');
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

  async function pickBatch() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please grant photo access.');
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
      Alert.alert('Permission needed', 'Please grant permission and try again.');
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
});
