import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { invalidateSignedPhotoUrl, signedPhotoUrl, supabase } from '@/lib/supabase';
import type { ClothingItem, ItemStatus } from '@/types';

const STATUSES: ItemStatus[] = ['keep', 'archive', 'donate'];

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<ClothingItem | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('clothing_items')
      .select('*')
      .eq('id', id)
      .single();
    if (!error && data) {
      setItem(data as ClothingItem);
      try {
        setUrl(await signedPhotoUrl(data.photo_path));
      } catch {}
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(next: ItemStatus) {
    if (!item) return;
    setBusy(true);
    const { error } = await supabase
      .from('clothing_items')
      .update({ status: next })
      .eq('id', item.id);
    setBusy(false);
    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }
    setItem({ ...item, status: next });
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
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: item.brand ?? item.category }} />
      <ScrollView>
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
          <Text style={styles.title}>{item.brand ?? 'Untitled'}</Text>
          <Text style={styles.meta}>
            {[item.category, item.color, item.material].filter(Boolean).join(' · ')}
          </Text>

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
                  <Text style={[styles.statusText, active && styles.statusTextActive]}>
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {item.status === 'donate' ? (
            <Text style={styles.hint}>
              This item is visible to other users in the donation feed.
            </Text>
          ) : null}

          <Pressable style={styles.delete} onPress={destroy}>
            <Text style={styles.deleteText}>Delete item</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageBox: { aspectRatio: 1, backgroundColor: '#eee' },
  image: { width: '100%', height: '100%' },
  body: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', textTransform: 'capitalize' },
  meta: { color: '#666', marginTop: 6, textTransform: 'capitalize' },
  label: { fontWeight: '600', marginTop: 20 },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  statusChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: '#eee',
  },
  statusChipActive: { backgroundColor: '#111' },
  statusText: { color: '#333', textTransform: 'capitalize' },
  statusTextActive: { color: '#fff' },
  hint: { color: '#777', marginTop: 16, fontStyle: 'italic' },
  delete: {
    marginTop: 32,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a00',
    alignItems: 'center',
  },
  deleteText: { color: '#a00', fontWeight: '600' },
});
