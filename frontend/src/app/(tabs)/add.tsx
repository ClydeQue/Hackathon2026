import { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Spinner } from '@/components/Spinner';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  TagEditor,
  type TagEditorErrors,
  type TagEditorValue,
} from '@/components/TagEditor';
import { scanPhoto, type ScanPhotoInput } from '@/lib/api';
import { createItemFromPickedPhoto } from '@/lib/items';

function PressBtn({ children, style, onPress, disabled }: { children: React.ReactNode; style?: any; onPress?: () => void; disabled?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => { if (disabled) return; Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 0 }).start(); };
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  return (
    <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={onPress} disabled={disabled}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

type Stage = 'pick' | 'confirm' | 'saving';

const DEFAULT_TAGS: TagEditorValue = {
  category: 'top',
  color: '',
  material: '',
  brand: '',
  condition: 'good',
};

function validate(tags: TagEditorValue): TagEditorErrors {
  const errors: TagEditorErrors = {};
  if (!tags.category) errors.category = 'Pick a category.';
  if (!tags.color.trim()) errors.color = 'Color is required.';
  if (!tags.material.trim()) errors.material = 'Material is required.';
  if (!tags.condition) errors.condition = 'Pick a condition.';
  return errors;
}

export default function AddItem() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('pick');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [scanPhotoInput, setScanPhotoInput] = useState<ScanPhotoInput | null>(null);
  const [tags, setTags] = useState<TagEditorValue>(DEFAULT_TAGS);
  const [errors, setErrors] = useState<TagEditorErrors>({});
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const aiTagsRef = useRef<Record<string, unknown> | null>(null);
  // Bumped on every reset/pick so an in-flight scan from a discarded
  // photo can't race-write tags onto the next photo.
  const scanGenRef = useRef(0);

  function reset() {
    scanGenRef.current += 1;
    setStage('pick');
    setPhotoUri(null);
    setScanPhotoInput(null);
    setTags(DEFAULT_TAGS);
    setErrors({});
    setScanning(false);
    setScanError(null);
    aiTagsRef.current = null;
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
      const kind = source === 'camera' ? 'Camera' : 'Photo';
      Alert.alert(
        `${kind} access denied`,
        `Enable ${kind.toLowerCase()} access for this app in Settings to continue.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.4,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.4,
          });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const photo: ScanPhotoInput = {
      uri: asset.uri,
      name: asset.fileName,
      type: asset.mimeType,
    };
    setPhotoUri(photo.uri);
    setScanPhotoInput(photo);
    setTags(DEFAULT_TAGS);
    setStage('confirm');
    void runScan(photo);
  }

  async function runScan(photo: ScanPhotoInput) {
    scanGenRef.current += 1;
    const gen = scanGenRef.current;
    setScanning(true);
    setScanError(null);
    aiTagsRef.current = null;
    console.log('[add] scan starting', photo);
    try {
      const result = await scanPhoto(photo);
      if (gen !== scanGenRef.current) return;
      console.log('[add] scan result', result);
      aiTagsRef.current = (result.raw as Record<string, unknown> | undefined) ?? null;
      // Only fill fields the user hasn't already edited away from defaults.
      setTags((current) => ({
        category:
          current.category === DEFAULT_TAGS.category ? result.category ?? current.category : current.category,
        color: current.color === DEFAULT_TAGS.color && result.color ? result.color : current.color,
        material:
          current.material === DEFAULT_TAGS.material && result.material ? result.material : current.material,
        brand: current.brand === DEFAULT_TAGS.brand && result.brand ? result.brand : current.brand,
        condition:
          current.condition === DEFAULT_TAGS.condition ? result.condition ?? current.condition : current.condition,
      }));
    } catch (err: any) {
      console.warn('[add] scan failed', err);
      if (gen === scanGenRef.current) {
        setScanError(err?.message ?? 'Auto-tag unavailable. Fill the fields manually.');
      }
    } finally {
      if (gen === scanGenRef.current) setScanning(false);
    }
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
        condition: tags.condition,
        ai_tags: aiTagsRef.current,
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
            <PressBtn style={styles.action} onPress={() => pickPhoto('camera')}>
              <Ionicons name="camera-outline" size={20} color="#F4FF61" />
              <Text style={styles.actionText}>Camera</Text>
            </PressBtn>
            <PressBtn style={styles.action} onPress={() => pickPhoto('library')}>
              <Ionicons name="images-outline" size={20} color="#F4FF61" />
              <Text style={styles.actionText}>Library</Text>
            </PressBtn>
          </View>
        ) : null}

        {stage === 'confirm' || stage === 'saving' ? (
          <>
            <Text style={styles.title}>Review tags</Text>
            <Text style={styles.hint}>
              We've auto-filled what we could see. Fix anything that's off, then save.
              Fields marked <Text style={styles.requiredHint}>*</Text> are required.
            </Text>
            {scanning ? (
              <View style={styles.scanPill}>
                <Spinner size={16} color="#111" />
                <Text style={styles.scanPillText}>Scanning photo…</Text>
              </View>
            ) : null}
            {!scanning && scanError ? (
              <View style={[styles.scanPill, styles.scanPillError]}>
                <Ionicons name="alert-circle-outline" size={16} color="#a00" />
                <Text style={styles.scanPillErrorText}>
                  {scanError} Fill the tags below to continue.
                </Text>
                {scanPhotoInput ? (
                  <Pressable
                    onPress={() => runScan(scanPhotoInput)}
                    style={styles.retryBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="refresh" size={14} color="#a00" />
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <TagEditor value={tags} onChange={updateTags} errors={errors} />
            <PressBtn
              style={[styles.save, stage === 'saving' && { opacity: 0.6 }]}
              disabled={stage === 'saving'}
              onPress={save}
            >
              <Text style={styles.saveText}>
                {stage === 'saving' ? 'Saving…' : 'Save to closet'}
              </Text>
            </PressBtn>
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
  container: { flex: 1, backgroundColor: '#EEF4FB' },
  scroll: { padding: 20, gap: 12 },
  preview: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#DCEAF6',
    borderWidth: 3,
    borderColor: '#0F1117',
    shadowColor: '#0F1117',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  previewEmpty: { justifyContent: 'center', alignItems: 'center' },
  previewHint: {
    color: '#0F1117',
    opacity: 0.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  action: {
    flex: 1,
    padding: 16,
    backgroundColor: '#0F1117',
    borderWidth: 3,
    borderColor: '#0F1117',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#0F1117',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  actionText: {
    color: '#F4FF61',
    fontWeight: '900',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  title: {
    fontFamily: 'WorkSans',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 16,
    color: '#0F1117',
    letterSpacing: -0.2,
  },
  hint: { color: '#0F1117', opacity: 0.65, fontSize: 13, lineHeight: 18 },
  requiredHint: { color: '#FF5C4D', fontWeight: '900' },
  save: {
    marginTop: 20,
    backgroundColor: '#2A6FDB',
    borderWidth: 3,
    borderColor: '#0F1117',
    padding: 16,
    alignItems: 'center',
    shadowColor: '#0F1117',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  saveText: {
    color: '#EEF4FB',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 14,
  },
  cancel: { marginTop: 8, padding: 12, alignItems: 'center' },
  cancelText: {
    color: '#FF5C4D',
    fontWeight: '900',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  scanPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#DCEAF6',
    borderWidth: 2,
    borderColor: '#0F1117',
    marginTop: 8,
  },
  scanPillText: {
    color: '#0F1117',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  scanPillError: { backgroundColor: '#FFE5E2', flexWrap: 'wrap' },
  scanPillErrorText: { color: '#FF5C4D', fontWeight: '700', flexShrink: 1 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#FF5C4D',
  },
  retryBtnText: { color: '#FF5C4D', fontWeight: '900', fontSize: 11 },
});
