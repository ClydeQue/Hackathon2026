import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Spinner } from '@/components/Spinner';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { invalidateSignedPhotoUrl, signedPhotoUrl, supabase } from '@/lib/supabase';
import type { ClothingItem, ItemCategory, ItemStatus } from '@/types';

const STATUSES: ItemStatus[] = ['keep', 'archive', 'donate'];
const CATEGORIES: ItemCategory[] = [
  'top',
  'bottom',
  'outerwear',
  'dress',
  'other',
];

type Draft = {
  brand: string;
  color: string;
  material: string;
  size: string;
  gender: string;
  category: ItemCategory;
};

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<ClothingItem | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reservedFor, setReservedFor] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    brand: '',
    color: '',
    material: '',
    size: '',
    gender: '',
    category: 'other',
  });

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('clothing_items')
      .select('*')
      .eq('id', id)
      .single();
    if (!error && data) {
      const fetched = data as ClothingItem;
      setItem(fetched);
      try {
        setUrl(await signedPhotoUrl(fetched.photo_path));
      } catch {}

      const { data: me } = await supabase.auth.getUser();
      const owner = !!me.user && me.user.id === fetched.owner_id;
      setIsOwner(owner);

      // Show "Reserved for X" only when the viewer owns the item and there's
      // an accepted (not-yet-received) swipe pending hand-off.
      if (owner && fetched.status === 'donate') {
        const { data: swipeRow } = await supabase
          .from('swipes')
          .select('swiper_id')
          .eq('item_id', fetched.id)
          .eq('status', 'accepted')
          .maybeSingle();
        if (swipeRow?.swiper_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', swipeRow.swiper_id)
            .maybeSingle();
          setReservedFor(profile?.display_name ?? 'someone');
        } else {
          setReservedFor(null);
        }
      } else {
        setReservedFor(null);
      }
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(next: ItemStatus) {
    if (!item) return;

    if (next === 'donate') {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('latitude,longitude')
          .eq('user_id', u.user.id)
          .single();
        if (!prof || prof.latitude == null || prof.longitude == null) {
          Alert.alert(
            'Pickup location required',
            'Set a pickup point on your profile so recipients know where to meet you.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Set location',
                onPress: () => router.push('/(tabs)/profile'),
              },
            ],
          );
          return;
        }
      }
    }

    setBusy(true);
    // Flipping OUT of donate clears the listing so a re-donated item starts
    // back as a draft instead of going straight back live with stale copy.
    const patch: Record<string, unknown> = { status: next };
    if (item.status === 'donate' && next !== 'donate') {
      patch.listed_at = null;
    }
    const { error } = await supabase
      .from('clothing_items')
      .update(patch)
      .eq('id', item.id);
    setBusy(false);
    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }
    setItem({ ...item, status: next, listed_at: next === 'donate' ? item.listed_at : null });
    // Marking an item as donate kicks off the listing form. If a draft or
    // live listing already exists, the form opens in edit mode.
    if (next === 'donate') {
      router.push(`/donate/${item.id}`);
    }
  }

  function startEdit() {
    if (!item) return;
    setDraft({
      brand: item.brand ?? '',
      color: item.color ?? '',
      material: item.material ?? '',
      size: item.size ?? '',
      gender: item.gender ?? '',
      category: item.category,
    });
    setEditing(true);
  }

  async function saveEdit() {
    if (!item) return;
    setBusy(true);
    const patch = {
      brand: draft.brand.trim() || null,
      color: draft.color.trim() || null,
      material: draft.material.trim() || null,
      size: draft.size.trim() || null,
      gender: draft.gender.trim() || null,
      category: draft.category,
    };
    const { error } = await supabase
      .from('clothing_items')
      .update(patch)
      .eq('id', item.id);
    setBusy(false);
    if (error) {
      Alert.alert('Save failed', error.message);
      return;
    }
    setItem({ ...item, ...patch });
    setEditing(false);
  }

  async function destroy() {
    if (!item) return;
    Alert.alert('Delete item?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('clothing_items').delete().eq('id', item.id);
          // Best-effort storage cleanup; ignore failures.
          await supabase.storage.from('garments').remove([item.photo_path]);
          invalidateSignedPhotoUrl(item.photo_path);
          router.back();
        },
      },
    ]);
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Spinner />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: item.brand ?? item.category,
          headerRight: () =>
            editing ? (
              <Pressable onPress={() => setEditing(false)} hitSlop={8}>
                <Text style={styles.headerActionMuted}>Cancel</Text>
              </Pressable>
            ) : (
              <Pressable onPress={startEdit} hitSlop={8}>
                <Ionicons name="create-outline" size={22} color="#111" />
              </Pressable>
            ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <View style={styles.imageBox}>
            {url ? (
              <Image
                source={{ uri: url, cacheKey: item.photo_path }}
                style={styles.image}
                contentFit="cover"
                transition={150}
              />
            ) : null}
          </View>
          <View style={styles.body}>
            {editing ? (
              <>
                <Text style={styles.label}>Brand / Name</Text>
                <TextInput
                  style={styles.input}
                  value={draft.brand}
                  onChangeText={(t) => setDraft((d) => ({ ...d, brand: t }))}
                  placeholder="e.g. Uniqlo, my linen shirt"
                  autoCapitalize="words"
                />

                <Text style={styles.label}>Category</Text>
                <View style={styles.pillRow}>
                  {CATEGORIES.map((c) => {
                    const active = draft.category === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => setDraft((d) => ({ ...d, category: c }))}
                        style={[styles.pill, active && styles.pillActive]}
                      >
                        <Text
                          style={[styles.pillText, active && styles.pillTextActive]}
                        >
                          {c}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.label}>Color</Text>
                <TextInput
                  style={styles.input}
                  value={draft.color}
                  onChangeText={(t) => setDraft((d) => ({ ...d, color: t }))}
                  placeholder="e.g. navy, cream"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Material</Text>
                <TextInput
                  style={styles.input}
                  value={draft.material}
                  onChangeText={(t) => setDraft((d) => ({ ...d, material: t }))}
                  placeholder="e.g. cotton, wool blend"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Size</Text>
                <TextInput
                  style={styles.input}
                  value={draft.size}
                  onChangeText={(t) => setDraft((d) => ({ ...d, size: t }))}
                  placeholder="e.g. XL, US 30, EU 38"
                  autoCapitalize="characters"
                />

                <Text style={styles.label}>Gender</Text>
                <TextInput
                  style={styles.input}
                  value={draft.gender}
                  onChangeText={(t) => setDraft((d) => ({ ...d, gender: t }))}
                  placeholder="e.g. unisex, women, men"
                  autoCapitalize="none"
                />

                <Pressable
                  style={[styles.save, busy && { opacity: 0.5 }]}
                  onPress={saveEdit}
                  disabled={busy}
                >
                  <Text style={styles.saveText}>{busy ? 'Saving…' : 'Save'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.title}>{item.brand ?? 'Untitled'}</Text>
                <Text style={styles.meta}>
                  {[
                    item.category,
                    item.color,
                    item.material,
                    item.size,
                    item.gender,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>

                {reservedFor && isOwner ? (
                  <View style={styles.reservedBanner}>
                    <Text style={styles.reservedText}>
                      Reserved for {reservedFor} — waiting for hand-off.
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.label}>Status</Text>
                <View style={styles.statusRow}>
                  {STATUSES.map((s) => {
                    const active = item.status === s;
                    return (
                      <Pressable
                        key={s}
                        onPress={() => !busy && setStatus(s)}
                        style={[styles.statusChip, active && styles.statusChipActive]}
                      >
                        <Text
                          style={[styles.statusText, active && styles.statusTextActive]}
                        >
                          {s}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {item.status === 'donate' ? (
                  <Text style={styles.hint}>
                    This item is visible to other users in Discover.
                  </Text>
                ) : null}

                <Pressable style={styles.delete} onPress={destroy}>
                  <Text style={styles.deleteText}>Delete item</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageBox: { aspectRatio: 1, backgroundColor: '#eee' },
  image: { width: '100%', height: '100%' },
  body: { padding: 20 },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#000',
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
  meta: {
    color: '#555',
    marginTop: 6,
    textTransform: 'capitalize',
    fontWeight: '700',
  },
  label: {
    fontWeight: '900',
    marginTop: 20,
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  statusChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
  },
  statusChipActive: { backgroundColor: '#000' },
  statusText: {
    color: '#000',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  statusTextActive: { color: '#fff' },
  hint: { color: '#666', marginTop: 16, fontWeight: '700' },
  delete: {
    marginTop: 32,
    padding: 14,
    borderRadius: 4,
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  deleteText: {
    color: '#000',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  input: {
    marginTop: 8,
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    backgroundColor: '#fff',
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 4,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
  },
  pillActive: { backgroundColor: '#000' },
  pillText: {
    color: '#000',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontSize: 12,
  },
  pillTextActive: { color: '#fff' },
  save: {
    marginTop: 28,
    padding: 16,
    borderRadius: 4,
    backgroundColor: '#000',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  saveText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  headerActionMuted: { color: '#666', fontWeight: '600', fontSize: 15 },
  reservedBanner: {
    marginTop: 16,
    padding: 12,
    borderRadius: 4,
    backgroundColor: '#4ECDC4',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  reservedText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
