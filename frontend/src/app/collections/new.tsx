import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Spinner } from '@/components/Spinner';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionSwiperDeck } from '@/components/ActionSwiperDeck';
import { signedPhotoUrl, supabase } from '@/lib/supabase';
import type { ClothingItem } from '@/types';

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

export default function NewCollection() {
  const router = useRouter();
  const [stage, setStage] = useState<'name' | 'swipe'>('name');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [items, setItems] = useState<ClothingItem[] | null>(null);

  const loadItems = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from('clothing_items')
      .select('*')
      .eq('owner_id', u.user.id)
      .order('created_at', { ascending: false });
    if (error) {
      Alert.alert('Couldn\'t load items', error.message);
      router.back();
      return;
    }
    setItems((data ?? []) as ClothingItem[]);
  }, [router]);

  async function startSwipe() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Give your collection a name.');
      return;
    }
    setCreating(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in.');
      const { data, error } = await supabase
        .from('collections')
        .insert({ owner_id: u.user.id, name: trimmed })
        .select()
        .single();
      if (error) throw error;
      setCollectionId(data.id);
      await loadItems();
      setStage('swipe');
    } catch (err: any) {
      Alert.alert('Couldn\'t create collection', err.message ?? String(err));
    } finally {
      setCreating(false);
    }
  }

  function addToCollection(item: ClothingItem) {
    if (!collectionId) return;
    supabase
      .from('collection_items')
      .insert({ collection_id: collectionId, item_id: item.id })
      .then(({ error }) => {
        // Duplicate inserts are fine (membership is idempotent).
        if (error && !error.message.toLowerCase().includes('duplicate')) {
          console.warn('[collections] add failed', error.message);
        }
      });
  }

  function finish() {
    if (collectionId) {
      router.replace(`/collections/${collectionId}`);
    } else {
      router.replace('/collections');
    }
  }

  if (stage === 'name') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.header}>
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/collections'))} hitSlop={12}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>New collection</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={styles.namePage}>
            <Text style={styles.nameLabel}>Name</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g. May 2026, work fits, beach"
              autoFocus
              returnKeyType="next"
              onSubmitEditing={startSwipe}
            />
            <Text style={styles.nameHint}>
              Next you'll swipe through your closet — right adds to the collection,
              left skips.
            </Text>
            <Pressable
              style={[styles.nextButton, creating && { opacity: 0.6 }]}
              onPress={startSwipe}
              disabled={creating}
            >
              <Text style={styles.nextText}>
                {creating ? 'Creating…' : 'Next'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (items === null) {
    return (
      <View style={styles.center}>
        <Spinner />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No items yet.</Text>
          <Text style={styles.emptyBody}>
            Add some clothes first, then come back to build a collection.
          </Text>
          <Pressable style={styles.doneBtn} onPress={finish}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={finish} hitSlop={12}>
          <Text style={styles.cancelText}>Done</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {name.trim()}
        </Text>
        <View style={{ width: 60 }} />
      </View>
      <Text style={styles.hint}>← Skip · Add →</Text>
      <ActionSwiperDeck
        cards={items}
        renderCard={(item) => <ItemCard item={item} />}
        onSwipeRight={(item) => addToCollection(item)}
        onSwipeLeft={() => {}}
        onAllDone={finish}
        rightLabel="ADD"
        leftLabel="SKIP"
        leftColor="#888"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF4FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 3, borderBottomColor: '#0F1117',
    backgroundColor: '#EEF4FB',
  },
  headerTitle: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 15, flex: 1, textAlign: 'center', color: '#0F1117',
  },
  cancelText: {
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 12, textTransform: 'uppercase',
    letterSpacing: 0.6, color: '#0F1117', opacity: 0.55, width: 60,
  },
  hint: {
    textAlign: 'center', color: '#0F1117', opacity: 0.5,
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.6, paddingVertical: 6,
  },
  namePage: { flex: 1, padding: 22 },
  nameLabel: {
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 10, textTransform: 'uppercase',
    letterSpacing: 0.9, color: '#0F1117',
    opacity: 0.7, marginBottom: 8,
  },
  nameInput: {
    borderWidth: 3, borderColor: '#0F1117',
    backgroundColor: '#EEF4FB',
    padding: 14, fontSize: 17,
    fontFamily: 'WorkSans', fontWeight: '600', color: '#0F1117',
    shadowColor: '#0F1117', shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  nameHint: {
    color: '#0F1117', opacity: 0.6,
    fontFamily: 'WorkSans', fontWeight: '500',
    fontSize: 13, lineHeight: 19, marginTop: 12,
  },
  nextButton: {
    backgroundColor: '#0F1117',
    borderWidth: 3, borderColor: '#0F1117',
    padding: 16, alignItems: 'center', marginTop: 24,
    shadowColor: '#0F1117', shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  nextText: {
    color: '#F4FF61', fontFamily: 'WorkSans',
    fontWeight: '900', textTransform: 'uppercase',
    letterSpacing: 0.8, fontSize: 14,
  },
  emptyTitle: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 20, color: '#0F1117',
  },
  emptyBody: {
    color: '#0F1117', opacity: 0.6,
    fontFamily: 'WorkSans', fontWeight: '500',
    marginTop: 8, textAlign: 'center', fontSize: 14,
  },
  doneBtn: {
    marginTop: 20,
    backgroundColor: '#0F1117',
    borderWidth: 3, borderColor: '#0F1117',
    paddingVertical: 14, paddingHorizontal: 24,
    shadowColor: '#0F1117', shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  doneText: {
    color: '#F4FF61', fontFamily: 'WorkSans',
    fontWeight: '900', textTransform: 'uppercase',
    letterSpacing: 0.8, fontSize: 13,
  },
  card: {
    flex: 1,
    backgroundColor: '#DCEAF6',
    borderWidth: 3, borderColor: '#0F1117',
    overflow: 'hidden',
    shadowColor: '#0F1117',
    shadowOpacity: 1, shadowRadius: 0,
    shadowOffset: { width: 5, height: 5 }, elevation: 0,
  },
  cardImage: { flex: 1, backgroundColor: '#C8DBF0' },
  cardMeta: { padding: 14, borderTopWidth: 2, borderTopColor: '#0F1117', backgroundColor: '#EEF4FB' },
  cardTitle: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 16, color: '#0F1117', textTransform: 'capitalize',
  },
  cardSub: {
    color: '#0F1117', opacity: 0.55, marginTop: 3,
    fontFamily: 'WorkSans', fontWeight: '600',
    fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4,
  },
});
