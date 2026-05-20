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
import { Ionicons } from '@expo/vector-icons';
import {
  TagEditor,
  type TagEditorErrors,
  type TagEditorValue,
} from '@/components/TagEditor';
import { createItemFromPickedPhoto } from '@/lib/items';

type Stage = 'pick' | 'confirm' | 'saving';

const DEFAULT_TAGS: TagEditorValue = {
  category: 'top',
  color: '',
  material: '',
  brand: '',
};

function validate(tags: TagEditorValue): TagEditorErrors {
  const errors: TagEditorErrors = {};
  if (!tags.category) errors.category = 'Pick a category.';
  if (!tags.color.trim()) errors.color = 'Color is required.';
  if (!tags.material.trim()) errors.material = 'Material is required.';
  return errors;
}

export default function AddItem() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('pick');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [tags, setTags] = useState<TagEditorValue>(DEFAULT_TAGS);
  const [errors, setErrors] = useState<TagEditorErrors>({});

  function reset() {
    setStage('pick');
    setPhotoUri(null);
    setTags(DEFAULT_TAGS);
    setErrors({});
  }

  function updateTags(next: TagEditorValue) {
    setTags(next);
    if (Object.keys(errors).length > 0) {
      setErrors(validate(next));
    }
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
    if (!photoUri) {
      Alert.alert('Photo required', 'Please add a photo before saving.');
      return;
    }
    const nextErrors = validate(tags);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setStage('saving');
    try {
      await createItemFromPickedPhoto({
        uri: photoUri,
        status: 'keep',
        category: tags.category,
        color: tags.color || null,
        material: tags.material || null,
        brand: tags.brand || null,
      });
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
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.actionText}>Camera</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={() => pickPhoto('library')}>
              <Ionicons name="images-outline" size={20} color="#fff" />
              <Text style={styles.actionText}>Library</Text>
            </Pressable>
          </View>
        ) : null}

        {stage === 'confirm' || stage === 'saving' ? (
          <>
            <Text style={styles.title}>Tag this item</Text>
            <Text style={styles.hint}>
              Pick a category and add details, then save. Fields marked{' '}
              <Text style={styles.requiredHint}>*</Text> are required.
            </Text>
            <TagEditor value={tags} onChange={updateTags} errors={errors} />
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
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionText: { color: '#fff', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  hint: { color: '#666' },
  requiredHint: { color: '#c00', fontWeight: '700' },
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
