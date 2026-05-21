import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { signedPhotoUrl, supabase } from '@/lib/supabase';
import type { ClothingItem } from '@/types';

type Draft = {
  listing_title: string;
  listing_message: string;
  pickup_note: string;
  available_until: string;
};

type Mode = 'edit' | 'success';

function defaultTitle(item: ClothingItem): string {
  return item.brand?.trim() || `${item.category}`.trim() || 'Donation';
}

// Visual progress bar for the message length: a red sliver until the 10-char
// minimum, green between min and max, with the current count to the right.
function MessageMeter({ length, max, min }: { length: number; max: number; min: number }) {
  const pct = Math.min(1, length / max);
  const minPct = min / max;
  const meets = length >= min;
  const color = meets ? '#0a7f33' : '#c98a00';
  return (
    <View style={styles.meterWrap}>
      <View style={styles.meterTrack}>
        <View
          style={[
            styles.meterFill,
            { width: `${Math.max(2, pct * 100)}%`, backgroundColor: color },
          ]}
        />
        <View style={[styles.meterMinTick, { left: `${minPct * 100}%` }]} />
      </View>
      <Text style={[styles.meterText, { color }]}>
        {length}/{max}
        {meets ? '' : ` (min ${min})`}
      </Text>
    </View>
  );
}

// Small chip under the date field that decodes "YYYY-MM-DD" into "in 3 days"
// so the user sees what they typed without scrolling to the bottom.
function DeadlinePreview({ value }: { value: string }) {
  const trimmed = value.trim();
  if (!trimmed) {
    return (
      <Text style={styles.helper}>Optional. Leave blank if you're not in a rush.</Text>
    );
  }
  const ts = Date.parse(trimmed);
  if (Number.isNaN(ts)) {
    return (
      <Text style={styles.helper}>Optional. Leave blank if you're not in a rush.</Text>
    );
  }
  const d = new Date(ts);
  const days = Math.round((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const tone =
    days < 0 ? '#c00' : days <= 2 ? '#c98a00' : '#0a7f33';
  const label =
    days < 0
      ? 'Already past'
      : days === 0
        ? 'Today'
        : days === 1
          ? 'Tomorrow'
          : `In ${days} days`;
  return (
    <View style={[styles.deadlineChip, { backgroundColor: tone + '22' }]}>
      <Ionicons name="time-outline" size={12} color={tone} />
      <Text style={[styles.deadlineChipText, { color: tone }]}>{label}</Text>
    </View>
  );
}

function validateDraft(draft: Draft) {
  const errors: Partial<Record<keyof Draft, string>> = {};
  if (!draft.listing_title.trim()) {
    errors.listing_title = 'Give your listing a name.';
  }
  if (!draft.listing_message.trim()) {
    errors.listing_message = 'A short note helps recipients decide.';
  } else if (draft.listing_message.trim().length < 10) {
    errors.listing_message = 'A bit more detail — at least 10 characters.';
  }
  if (
    draft.available_until.trim() &&
    Number.isNaN(Date.parse(draft.available_until.trim()))
  ) {
    errors.available_until = 'Use YYYY-MM-DD (e.g. 2026-06-30).';
  }
  return errors;
}

export default function DonateListing() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ClothingItem | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('edit');
  const [busy, setBusy] = useState<'idle' | 'saving' | 'publishing' | 'unlisting'>(
    'idle',
  );
  const [draft, setDraft] = useState<Draft>({
    listing_title: '',
    listing_message: '',
    pickup_note: '',
    available_until: '',
  });
  const [touched, setTouched] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('clothing_items')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) {
      Alert.alert('Listing not found', error?.message ?? 'Item missing.');
      router.back();
      return;
    }
    const it = data as ClothingItem;
    setItem(it);
    setDraft({
      listing_title: it.listing_title ?? defaultTitle(it),
      listing_message: it.listing_message ?? '',
      pickup_note: it.pickup_note ?? '',
      available_until: it.available_until ? it.available_until.slice(0, 10) : '',
    });
    try {
      setPhotoUrl(await signedPhotoUrl(it.photo_path));
    } catch {}
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const errors = useMemo(() => validateDraft(draft), [draft]);
  const hasErrors = Object.keys(errors).length > 0;
  const missingCount = Object.keys(errors).length;
  const isListed = !!item?.listed_at;

  function updateField(key: keyof Draft, value: string) {
    setTouched(true);
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function persist(extra: Partial<{ listed_at: string | null }> = {}) {
    if (!item) return null;
    const payload = {
      listing_title: draft.listing_title.trim(),
      listing_message: draft.listing_message.trim(),
      pickup_note: draft.pickup_note.trim() || null,
      available_until: draft.available_until.trim()
        ? new Date(draft.available_until.trim()).toISOString()
        : null,
      ...extra,
    };
    const { data, error } = await supabase
      .from('clothing_items')
      .update(payload)
      .eq('id', item.id)
      .select()
      .single();
    if (error) {
      Alert.alert('Save failed', error.message);
      return null;
    }
    const next = data as ClothingItem;
    setItem(next);
    return next;
  }

  async function saveDraft() {
    if (busy !== 'idle') return;
    setBusy('saving');
    const next = await persist();
    setBusy('idle');
    if (next) router.back();
  }

  async function publish() {
    if (busy !== 'idle' || hasErrors) return;
    setBusy('publishing');
    const next = await persist({ listed_at: new Date().toISOString() });
    setBusy('idle');
    if (next) setMode('success');
  }

  async function unlist() {
    if (busy !== 'idle' || !item) return;
    Alert.alert(
      'Unlist this item?',
      'It will be hidden from Discover. Your details stay saved as a draft.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlist',
          style: 'destructive',
          onPress: async () => {
            setBusy('unlisting');
            await persist({ listed_at: null });
            setBusy('idle');
          },
        },
      ],
    );
  }

  if (loading || !item) {
    return (
      <View style={styles.center}>
        <Spinner />
      </View>
    );
  }

  // ----- Success state -----------------------------------------------------
  if (mode === 'success') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Stack.Screen options={{ headerShown: true, title: 'Listed' }} />
        <View style={styles.center}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={42} color="#0F1117" />
          </View>
          <Text style={styles.successTitle}>Your listing is live.</Text>
          <Text style={styles.successBody}>
            “{draft.listing_title.trim()}” is now visible to others in Discover.
            You can edit or unlist it any time from your closet.
          </Text>
          <View style={styles.successActions}>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => router.replace('/(tabs)/discover')}
            >
              <Ionicons name="compass-outline" size={16} color="#F4FF61" />
              <Text style={styles.btnPrimaryText}>View Discover</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={() => router.replace('/(tabs)')}
            >
              <Ionicons name="shirt-outline" size={16} color="#0F1117" />
              <Text style={styles.btnGhostText}>Back to closet</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ----- Edit state --------------------------------------------------------
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: isListed ? 'Edit listing' : 'List for donation',
          headerRight: () =>
            isListed ? (
              <View style={styles.statusPillListed}>
                <Ionicons name="checkmark-circle" size={14} color="#0a7f33" />
                <Text style={styles.statusPillListedText}>Listed</Text>
              </View>
            ) : (
              <View style={styles.statusPillDraft}>
                <Text style={styles.statusPillDraftText}>Draft</Text>
              </View>
            ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.previewRow}>
            <View style={styles.previewBox}>
              {photoUrl ? (
                <Image
                  source={{ uri: photoUrl, cacheKey: item.photo_path }}
                  style={styles.preview}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <View style={styles.previewFallback}>
                  <Ionicons name="shirt-outline" size={28} color="#bbb" />
                </View>
              )}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.previewMeta} numberOfLines={1}>
                {[item.brand, item.category].filter(Boolean).join(' · ')}
              </Text>
              <View style={styles.previewPillRow}>
                {item.condition ? (
                  <View style={styles.previewPill}>
                    <Ionicons name="sparkles-outline" size={11} color="#444" />
                    <Text style={styles.previewPillText}>
                      {item.condition.replace('_', ' ')}
                    </Text>
                  </View>
                ) : null}
                {item.size ? (
                  <View style={styles.previewPill}>
                    <Ionicons name="resize-outline" size={11} color="#444" />
                    <Text style={styles.previewPillText}>{item.size}</Text>
                  </View>
                ) : null}
                {item.color ? (
                  <View style={styles.previewPill}>
                    <Ionicons name="color-palette-outline" size={11} color="#444" />
                    <Text style={styles.previewPillText}>{item.color}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.intro}>
            <Ionicons name="information-circle-outline" size={16} color="#666" />
            <Text style={styles.introText}>
              Tell recipients what they're getting and how to pick it up. You can
              save as a draft and finish later.
            </Text>
          </View>

          {/* Title */}
          <View style={styles.labelRow}>
            <Ionicons name="pricetag-outline" size={14} color="#111" />
            <Text style={styles.label}>
              Title <Text style={styles.required}>*</Text>
            </Text>
          </View>
          <TextInput
            style={[
              styles.input,
              touched && errors.listing_title ? styles.inputError : null,
            ]}
            value={draft.listing_title}
            onChangeText={(t) => updateField('listing_title', t)}
            placeholder={defaultTitle(item)}
            maxLength={60}
          />
          {touched && errors.listing_title ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={13} color="#c00" />
              <Text style={styles.errorText}>{errors.listing_title}</Text>
            </View>
          ) : (
            <Text style={styles.helper}>
              Short and recognizable — what the item is.
            </Text>
          )}

          {/* Message */}
          <View style={styles.labelRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color="#111" />
            <Text style={styles.label}>
              Message to recipients <Text style={styles.required}>*</Text>
            </Text>
          </View>
          <TextInput
            style={[
              styles.input,
              styles.inputMultiline,
              touched && errors.listing_message ? styles.inputError : null,
            ]}
            value={draft.listing_message}
            onChangeText={(t) => updateField('listing_message', t)}
            placeholder="Worn a few times, light pilling on the cuffs but still warm and clean. Happy to pass it on."
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <MessageMeter length={draft.listing_message.trim().length} max={500} min={10} />
          {touched && errors.listing_message ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={13} color="#c00" />
              <Text style={styles.errorText}>{errors.listing_message}</Text>
            </View>
          ) : (
            <Text style={styles.helper}>
              Mention condition quirks, sizing, fit, and why you're letting it
              go.
            </Text>
          )}

          {/* Pickup */}
          <View style={styles.labelRow}>
            <Ionicons name="location-outline" size={14} color="#111" />
            <Text style={styles.label}>Pickup / handoff note</Text>
          </View>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={draft.pickup_note}
            onChangeText={(t) => updateField('pickup_note', t)}
            placeholder="Pickup outside the main library, weekdays after 6pm."
            multiline
            numberOfLines={3}
            maxLength={300}
          />
          <Text style={styles.helper}>
            Optional. Your profile pin still anchors the map; this just adds
            timing or door-side details.
          </Text>

          {/* Available until */}
          <View style={styles.labelRow}>
            <Ionicons name="calendar-outline" size={14} color="#111" />
            <Text style={styles.label}>Available until</Text>
          </View>
          <TextInput
            style={[
              styles.input,
              touched && errors.available_until ? styles.inputError : null,
            ]}
            value={draft.available_until}
            onChangeText={(t) => updateField('available_until', t)}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
          />
          {touched && errors.available_until ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={13} color="#c00" />
              <Text style={styles.errorText}>{errors.available_until}</Text>
            </View>
          ) : (
            <DeadlinePreview value={draft.available_until} />
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {hasErrors ? (
              <Text style={styles.actionsHint}>
                {missingCount} thing{missingCount === 1 ? '' : 's'} to fix before
                publishing.
              </Text>
            ) : isListed ? (
              <Text style={styles.actionsHint}>
                This listing is live. Saving updates it in place.
              </Text>
            ) : (
              <Text style={styles.actionsHint}>
                Ready to publish — recipients will see your listing instantly.
              </Text>
            )}

            <Pressable
              style={[
                styles.btn,
                styles.btnPrimary,
                (hasErrors || busy !== 'idle') && styles.btnDisabled,
              ]}
              onPress={publish}
              disabled={hasErrors || busy !== 'idle'}
            >
              {busy === 'publishing' ? (
                <Spinner color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={isListed ? 'sync-outline' : 'paper-plane-outline'}
                    size={16}
                    color="#F4FF61"
                  />
                  <Text style={styles.btnPrimaryText}>
                    {isListed ? 'Update listing' : 'Publish listing'}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={saveDraft}
              disabled={busy !== 'idle'}
            >
              {busy === 'saving' ? (
                <Spinner color="#111" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={16} color="#0F1117" />
                  <Text style={styles.btnGhostText}>Save as draft</Text>
                </>
              )}
            </Pressable>

            {isListed ? (
              <Pressable
                style={[styles.btn, styles.btnDanger]}
                onPress={unlist}
                disabled={busy !== 'idle'}
              >
                {busy === 'unlisting' ? (
                  <Spinner color="#a00" />
                ) : (
                  <>
                    <Ionicons name="eye-off-outline" size={16} color="#EEF4FB" />
                    <Text style={styles.btnDangerText}>Unlist</Text>
                  </>
                )}
              </Pressable>
            ) : null}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const INK = '#0F1117';
const CREAM = '#EEF4FB';
const PAPER = '#DCEAF6';
const LIME = '#F4FF61';
const SUN = '#FFAE2D';
const CORAL = '#FF5C4D';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 20, paddingBottom: 60, gap: 4 },

  previewRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  previewBox: {
    width: 84,
    height: 84,
    overflow: 'hidden',
    backgroundColor: PAPER,
    borderWidth: 3,
    borderColor: INK,
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  previewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { width: '100%', height: '100%' },
  previewMeta: {
    fontSize: 16,
    fontFamily: 'WorkSans',
    fontWeight: '800',
    textTransform: 'capitalize',
    color: INK,
  },
  previewPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: PAPER,
    borderWidth: 2,
    borderColor: INK,
  },
  previewPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: INK,
    textTransform: 'capitalize',
  },

  intro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 18,
    marginBottom: 6,
    padding: 12,
    backgroundColor: PAPER,
    borderWidth: 2,
    borderColor: INK,
  },
  introText: { color: INK, opacity: 0.75, fontSize: 13, lineHeight: 19, flex: 1 },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  label: {
    fontFamily: 'WorkSans',
    fontWeight: '800',
    color: INK,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  required: { color: CORAL },
  input: {
    marginTop: 6,
    borderWidth: 3,
    borderColor: INK,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    fontWeight: '700',
    color: INK,
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  inputError: { borderColor: CORAL },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  errorText: { color: CORAL, fontSize: 13, fontWeight: '700' },
  helper: { color: INK, opacity: 0.55, fontSize: 12, marginTop: 4 },

  meterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  meterTrack: {
    flex: 1,
    height: 6,
    backgroundColor: PAPER,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: INK,
  },
  meterFill: { height: '100%' },
  meterMinTick: {
    position: 'absolute',
    top: -2,
    width: 1,
    height: 10,
    backgroundColor: INK,
  },
  meterText: { fontSize: 11, fontWeight: '700', minWidth: 70, textAlign: 'right', color: INK },

  deadlineChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 6,
    borderWidth: 2,
    borderColor: INK,
  },
  deadlineChipText: { fontSize: 12, fontWeight: '700' },

  actions: { marginTop: 24, gap: 10 },
  actionsHint: {
    color: INK,
    opacity: 0.65,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 6,
    fontWeight: '600',
  },
  btn: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: INK,
    shadowColor: INK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  btnPrimary: { backgroundColor: INK },
  btnPrimaryText: {
    color: LIME,
    fontFamily: 'WorkSans',
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  btnGhost: { backgroundColor: CREAM },
  btnGhostText: {
    color: INK,
    fontFamily: 'WorkSans',
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  btnDanger: { backgroundColor: CORAL },
  btnDangerText: {
    color: CREAM,
    fontFamily: 'WorkSans',
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  btnDisabled: { opacity: 0.45 },

  statusPillListed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: LIME,
    borderWidth: 2,
    borderColor: INK,
  },
  statusPillListedText: { color: INK, fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  statusPillDraft: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: SUN,
    borderWidth: 2,
    borderColor: INK,
  },
  statusPillDraftText: { color: INK, fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },

  successIcon: {
    width: 72,
    height: 72,
    backgroundColor: LIME,
    borderWidth: 3,
    borderColor: INK,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: INK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  successTitle: { fontSize: 22, fontFamily: 'WorkSans', fontWeight: '900', color: INK },
  successBody: {
    marginTop: 10,
    color: INK,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
  },
  successActions: { marginTop: 28, alignSelf: 'stretch', gap: 10 },
});
