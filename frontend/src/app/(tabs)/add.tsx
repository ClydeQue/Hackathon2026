import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TagEditor, type TagEditorValue } from '@/components/TagEditor';
import { STORAGE_BUCKET, supabase } from '@/lib/supabase';

type Stage = 'pick' | 'confirm' | 'saving';

const DEFAULT_TAGS: TagEditorValue = {
  category: 'top',
  color: '',
  material: '',
  brand: '',
};

export default function AddItem() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('pick');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [tags, setTags] = useState<TagEditorValue>(DEFAULT_TAGS);

  function reset() {
    setStage('pick');
    setPhotoUri(null);
    setTags(DEFAULT_TAGS);
  }

  async function pickPhoto(source: 'camera' | 'library') {
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
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          });
    if (result.canceled || !result.assets?.[0]) return;
    setPhotoUri(result.assets[0].uri);
    setTags(DEFAULT_TAGS);
    setStage('confirm');
  }

  async function save() {
    if (!photoUri) return;
    setStage('saving');
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');

      const itemId = crypto.randomUUID();
      const path = `${u.user.id}/${itemId}.jpg`;

      const blob = await (await fetch(photoUri)).blob();
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('clothing_items').insert({
        id: itemId,
        owner_id: u.user.id,
        photo_path: path,
        category: tags.category,
        color: tags.color || null,
        material: tags.material || null,
        brand: tags.brand || null,
        ai_tags: null,
        status: 'keep',
      });
      if (insErr) throw insErr;

      reset();
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Save failed', err.message ?? String(err));
      setStage('confirm');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.preview} />
        ) : (
          <View style={[styles.preview, styles.previewEmpty]}>
            <Text style={styles.previewHint}>No photo yet</Text>
          </View>
        )}

        {stage === 'pick' ? (
          <View style={styles.actionRow}>
            <Pressable style={styles.action} onPress={() => pickPhoto('camera')}>
              <Text style={styles.actionText}>📷 Camera</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={() => pickPhoto('library')}>
              <Text style={styles.actionText}>🖼 Library</Text>
            </Pressable>
          </View>
        ) : null}

        {stage === 'confirm' || stage === 'saving' ? (
          <>
            <Text style={styles.title}>Tag this item</Text>
            <Text style={styles.hint}>Pick a category and add details, then save.</Text>
            <TagEditor value={tags} onChange={setTags} />
            <Pressable
              style={[styles.save, stage === 'saving' && { opacity: 0.6 }]}
              disabled={stage === 'saving'}
              onPress={save}
            >
              <Text style={styles.saveText}>
                {stage === 'saving' ? 'Saving…' : 'Save to closet'}
              </Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={reset}>
              <Text style={styles.cancelText}>Discard</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20, gap: 12 },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: '#eee' },
  previewEmpty: { justifyContent: 'center', alignItems: 'center' },
  previewHint: { color: '#888' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  action: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  actionText: { color: '#fff', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  hint: { color: '#666' },
  save: {
    marginTop: 20,
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '600' },
  cancel: { marginTop: 8, padding: 12, alignItems: 'center' },
  cancelText: { color: '#a00' },
});
