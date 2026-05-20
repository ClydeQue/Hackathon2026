import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Spinner } from '@/components/Spinner';
import * as Crypto from 'expo-crypto';
import { readAsStringAsync } from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { MapPin } from '@/components/MapPin';
import { AVATAR_BUCKET, avatarPublicUrl, supabase } from '@/lib/supabase';
import { DM_SERIF } from '@/lib/fonts';
import type { Profile } from '@/types';

function base64ToBytes(b64: string): Uint8Array {
  const bin = global.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [locatingMe, setLocatingMe] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setEmail(u.user.email ?? null);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', u.user.id)
      .single();
    setProfile(data as Profile | null);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  function update<K extends keyof Profile>(k: K, v: Profile[K]) {
    if (!profile) return;
    setProfile({ ...profile, [k]: v });
  }

  async function pickAvatar() {
    if (!profile || uploadingAvatar) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please grant photo access to set an avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;

    setUploadingAvatar(true);
    const previousPath = profile.avatar_url;
    try {
      const base64 = await readAsStringAsync(uri, { encoding: 'base64' });
      const bytes = base64ToBytes(base64);
      if (bytes.byteLength === 0) throw new Error('Read 0 bytes from picked image.');

      const newPath = `${profile.user_id}/${Crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(newPath, bytes, { contentType: 'image/jpeg', upsert: false });
      if (upErr) {
        if (/bucket.*not found/i.test(upErr.message)) {
          throw new Error(
            `Storage bucket "${AVATAR_BUCKET}" is missing. Run supabase/migrations/0004_avatars.sql in Supabase Studio.`,
          );
        }
        throw upErr;
      }

      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: newPath })
        .eq('user_id', profile.user_id);
      if (dbErr) throw dbErr;

      setProfile({ ...profile, avatar_url: newPath });

      // Best-effort cleanup of the previous avatar — ignore failures so we
      // never block the user on a leftover file.
      if (previousPath && previousPath !== newPath) {
        supabase.storage.from(AVATAR_BUCKET).remove([previousPath]).catch(() => {});
      }
    } catch (err: any) {
      Alert.alert('Avatar upload failed', err?.message ?? String(err));
    } finally {
      setUploadingAvatar(false);
    }
  }

  const [pickerOpen, setPickerOpen] = useState(false);

  // Persist the final coordinates after the user confirms in the picker
  // modal. Optimistically update local state so the inline map reflects the
  // change immediately; revert on failure.
  async function setPickup(lat: number, lng: number) {
    if (!profile) return;
    const prev = { lat: profile.latitude, lng: profile.longitude };
    setProfile({ ...profile, latitude: lat, longitude: lng });
    const { error } = await supabase
      .from('profiles')
      .update({ latitude: lat, longitude: lng })
      .eq('user_id', profile.user_id);
    if (error) {
      Alert.alert('Could not save pickup', error.message);
      setProfile({ ...profile, latitude: prev.lat, longitude: prev.lng });
    }
  }

  async function useCurrentLocation() {
    if (!profile || locatingMe) return;
    setLocatingMe(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Location access denied',
          'Enable location access for SlowFashion in Settings to set your pickup point.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const { error } = await supabase
        .from('profiles')
        .update({ latitude: lat, longitude: lng })
        .eq('user_id', profile.user_id);
      if (error) throw error;
      setProfile({ ...profile, latitude: lat, longitude: lng });
    } catch (err: any) {
      Alert.alert('Could not get location', err?.message ?? String(err));
    } finally {
      setLocatingMe(false);
    }
  }

  async function save() {
    if (!profile) return;
    if (!profile.display_name.trim()) {
      Alert.alert('Display name required', 'Please add a display name.');
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: profile.display_name.trim(),
        contact_email: profile.contact_email,
        contact_phone: profile.contact_phone,
        contact_handle: profile.contact_handle,
      })
      .eq('user_id', profile.user_id);
    setBusy(false);
    if (error) Alert.alert('Save failed', error.message);
    else Alert.alert('Saved', 'Profile updated.');
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (loading || !profile) {
    return (
      <View style={styles.center}>
        <Spinner />
      </View>
    );
  }

  const initials = (profile.display_name || email || '?')
    .split(/\s+/)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable onPress={pickAvatar} style={styles.avatarWrap}>
            {profile.avatar_url ? (
              <Image
                source={{
                  uri: avatarPublicUrl(profile.avatar_url),
                  cacheKey: profile.avatar_url,
                }}
                style={styles.avatar}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.avatarEdit}>
              {uploadingAvatar ? (
                <Spinner size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={16} color="#fff" />
              )}
            </View>
          </Pressable>
          <Text style={styles.displayName} numberOfLines={1}>
            {profile.display_name || 'No name yet'}
          </Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Public profile</Text>
          <Text style={styles.label}>Display name</Text>
          <TextInput
            style={styles.input}
            value={profile.display_name}
            onChangeText={(t) => update('display_name', t)}
            placeholder="How others see you"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Contact info</Text>
          <Text style={styles.hint}>
            Shown to people who pick up your donations. Leave any field blank to hide it.
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={profile.contact_email ?? ''}
            onChangeText={(t) => update('contact_email', t || null)}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="optional"
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={profile.contact_phone ?? ''}
            onChangeText={(t) => update('contact_phone', t || null)}
            keyboardType="phone-pad"
            placeholder="optional"
          />

          <Text style={styles.label}>Handle (Instagram, etc.)</Text>
          <TextInput
            style={styles.input}
            value={profile.contact_handle ?? ''}
            onChangeText={(t) => update('contact_handle', t || null)}
            autoCapitalize="none"
            placeholder="optional"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Pickup location</Text>
          <Text style={styles.hint}>
            Required to donate. We show this pin to people viewing your donations so
            they know where to meet you.
          </Text>

          {profile.latitude != null && profile.longitude != null ? (
            <>
              <Pressable
                onPress={() => setPickerOpen(true)}
                style={styles.mapPreviewWrap}
              >
                <MapPin
                  latitude={profile.latitude}
                  longitude={profile.longitude}
                  label="Your pickup point"
                  style={styles.map}
                />
                {/* Overlay catches the tap — Leaflet swallows touches inside
                    the WebView, so we need our own hit target on top. */}
                <View style={styles.mapPreviewOverlay}>
                  <View style={styles.mapPreviewBadge}>
                    <Ionicons name="expand-outline" size={14} color="#fff" />
                    <Text style={styles.mapPreviewBadgeText}>
                      Tap to adjust
                    </Text>
                  </View>
                </View>
              </Pressable>
              <Pressable
                style={styles.mapOpenButton}
                onPress={() => {
                  const lat = profile.latitude!;
                  const lng = profile.longitude!;
                  const url =
                    Platform.OS === 'ios'
                      ? `http://maps.apple.com/?ll=${lat},${lng}&q=Pickup`
                      : `https://maps.apple.com/?ll=${lat},${lng}&q=Pickup`;
                  Linking.openURL(url).catch(() => {});
                }}
              >
                <Ionicons name="open-outline" size={16} color="#111" />
                <Text style={styles.mapOpenButtonText}>Open in Apple Maps</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={styles.mapEmpty}
              onPress={() => setPickerOpen(true)}
            >
              <Ionicons name="location-outline" size={28} color="#aaa" />
              <Text style={styles.mapEmptyText}>Tap to set pickup point</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.locationButton, locatingMe && { opacity: 0.6 }]}
            onPress={useCurrentLocation}
            disabled={locatingMe}
          >
            {locatingMe ? (
              <Spinner size="small" color="#111" />
            ) : (
              <Ionicons name="locate-outline" size={18} color="#111" />
            )}
            <Text style={styles.locationButtonText}>
              {locatingMe
                ? 'Getting location…'
                : profile.latitude != null
                  ? 'Update to current location'
                  : 'Use my current location'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.button, busy && { opacity: 0.6 }]}
          onPress={save}
          disabled={busy}
        >
          <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Save'}</Text>
        </Pressable>

        <Pressable style={styles.signOut} onPress={signOut}>
          <Ionicons name="log-out-outline" size={18} color="#a00" />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <PickupPickerModal
        visible={pickerOpen}
        initialLat={profile.latitude}
        initialLng={profile.longitude}
        onClose={() => setPickerOpen(false)}
        onConfirm={async (lat, lng) => {
          setPickerOpen(false);
          await setPickup(lat, lng);
        }}
      />
    </SafeAreaView>
  );
}

// =====================================================================
// PickupPickerModal — full-screen map + address search + draggable pin.
// Lives in the same file because it's only ever used here and shares the
// MapPin component / Supabase shape with the parent.
// =====================================================================
const DEFAULT_LAT = 14.5995; // Manila — only used when the user has never set a pickup.
const DEFAULT_LNG = 120.9842;

function PickupPickerModal({
  visible,
  initialLat,
  initialLng,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  initialLat: number | null;
  initialLng: number | null;
  onClose: () => void;
  onConfirm: (lat: number, lng: number) => void;
}) {
  const [lat, setLat] = useState<number>(initialLat ?? DEFAULT_LAT);
  const [lng, setLng] = useState<number>(initialLng ?? DEFAULT_LNG);
  const [address, setAddress] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  // Reset drafts whenever the modal re-opens.
  useEffect(() => {
    if (!visible) return;
    setLat(initialLat ?? DEFAULT_LAT);
    setLng(initialLng ?? DEFAULT_LNG);
    setAddress('');
  }, [visible, initialLat, initialLng]);

  // Reverse-geocode the current draft so the user can read a human address
  // under the map. Debounced via a small timeout to avoid hammering the
  // platform geocoder while the pin is being dragged repeatedly.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });
        if (cancelled) return;
        const p = places?.[0];
        if (!p) {
          setResolvedAddress(null);
          return;
        }
        const parts = [
          p.name,
          p.street,
          p.city,
          p.region,
          p.country,
        ].filter(
          (x, i, arr): x is string => !!x && (i === 0 || x !== arr[i - 1]),
        );
        setResolvedAddress(parts.join(', '));
      } catch {
        if (!cancelled) setResolvedAddress(null);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [visible, lat, lng]);

  async function searchAddress() {
    const q = address.trim();
    if (!q || searching) return;
    setSearching(true);
    try {
      const results = await Location.geocodeAsync(q);
      const hit = results?.[0];
      if (!hit) {
        Alert.alert('Address not found', 'Try a more specific search.');
        return;
      }
      setLat(hit.latitude);
      setLng(hit.longitude);
    } catch (err: any) {
      Alert.alert('Search failed', err?.message ?? String(err));
    } finally {
      setSearching(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      {/* Modal renders in a detached React tree, so SafeAreaView from
          react-native-safe-area-context loses its provider context and the
          header drifts under the status bar / notch. Reinjecting a provider
          with initialWindowMetrics restores the insets inside the modal. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaView style={pickerStyles.container} edges={['top', 'bottom']}>
        <View style={pickerStyles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={16}
            style={({ pressed }) => [
              pickerStyles.headerBtn,
              pickerStyles.headerBtnLeft,
              pressed && pickerStyles.headerBtnPressed,
            ]}
          >
            <Ionicons name="chevron-back" size={22} color="#111" />
            <Text style={pickerStyles.headerCancel}>Cancel</Text>
          </Pressable>
          <Text style={pickerStyles.headerTitle}>Pickup location</Text>
          <Pressable
            onPress={() => onConfirm(lat, lng)}
            hitSlop={16}
            style={({ pressed }) => [
              pickerStyles.headerBtn,
              pickerStyles.headerBtnRight,
              pressed && pickerStyles.headerBtnPressed,
            ]}
          >
            <Text style={pickerStyles.headerSave}>Save</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <View style={pickerStyles.searchRow}>
            <Ionicons name="search-outline" size={18} color="#666" />
            <TextInput
              style={pickerStyles.searchInput}
              value={address}
              onChangeText={setAddress}
              placeholder="Search an address or place"
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={searchAddress}
            />
            <Pressable
              onPress={searchAddress}
              disabled={!address.trim() || searching}
              style={[
                pickerStyles.searchBtn,
                (!address.trim() || searching) && { opacity: 0.5 },
              ]}
            >
              {searching ? (
                <Spinner color="#fff" size="small" />
              ) : (
                <Text style={pickerStyles.searchBtnText}>Find</Text>
              )}
            </Pressable>
          </View>

          <View style={pickerStyles.mapWrap}>
            <MapPin
              latitude={lat}
              longitude={lng}
              label="Pickup"
              zoom={15}
              style={{ flex: 1 }}
              onChange={(nextLat, nextLng) => {
                setLat(nextLat);
                setLng(nextLng);
              }}
            />
          </View>

          <View style={pickerStyles.footer}>
            <Text style={pickerStyles.footerHint}>
              Drag the pin or tap the map. Use search to jump to an address.
            </Text>
            {resolvedAddress ? (
              <Text style={pickerStyles.footerAddress} numberOfLines={2}>
                {resolvedAddress}
              </Text>
            ) : null}
            <Text style={pickerStyles.footerCoords}>
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e3e3e3',
    backgroundColor: '#fff',
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 92,
  },
  headerBtnLeft: { justifyContent: 'flex-start', gap: 2 },
  headerBtnRight: { justifyContent: 'flex-end' },
  headerBtnPressed: { backgroundColor: '#f0f0f0' },
  headerCancel: { color: '#444', fontWeight: '600', fontSize: 15 },
  headerTitle: { fontWeight: '700', fontSize: 16 },
  headerSave: {
    color: '#0a7f33',
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'right',
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    fontSize: 15,
  },
  searchBtn: {
    backgroundColor: '#111',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    minWidth: 60,
    alignItems: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '700' },
  mapWrap: { flex: 1, backgroundColor: '#f3efe8' },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    gap: 4,
  },
  footerHint: { color: '#666', fontSize: 12 },
  footerAddress: {
    color: '#111',
    fontWeight: '600',
    fontSize: 14,
    marginTop: 4,
  },
  footerCoords: { color: '#888', fontSize: 11, fontVariant: ['tabular-nums'] },
});

const AVATAR_SIZE = 112;

// Brutalist tokens — thick black borders, hard offset shadows (low blur, big
// offset), warm off-white background, red & yellow accents.
const BR_BORDER = '#111';
const BR_BG = '#fdfaf2';
const BR_RED = '#d63a2f';
const BR_YELLOW = '#ffe14a';
const BR_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.18,
  shadowRadius: 0,
  shadowOffset: { width: 3, height: 4 },
  elevation: 3,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BR_BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, gap: 20, paddingBottom: 40 },

  header: { alignItems: 'center', marginTop: 8, marginBottom: 8 },
  avatarWrap: { position: 'relative', ...BR_SHADOW },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: BR_BORDER,
  },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 36, fontWeight: '900', color: '#111' },
  avatarEdit: {
    position: 'absolute',
    right: 2,
    bottom: 6,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BR_RED,
    borderWidth: 2,
    borderColor: BR_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: {
    fontFamily: DM_SERIF.regular,
    fontSize: 30,
    color: '#111',
    marginTop: 18,
    maxWidth: '90%',
    textAlign: 'center',
  },
  email: {
    color: '#666',
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
  },

  card: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: BR_BORDER,
    borderRadius: 12,
    padding: 16,
    gap: 4,
    ...BR_SHADOW,
  },
  // Red pill tag instead of a plain section heading — matches the onboarding
  // "STEP 1 OF 2" chip.
  section: {
    alignSelf: 'flex-start',
    color: '#fff',
    backgroundColor: BR_RED,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  label: {
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 12,
    color: '#111',
  },
  hint: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
    lineHeight: 18,
  },
  input: {
    borderWidth: 2,
    borderColor: BR_BORDER,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    fontWeight: '500',
    marginTop: 6,
    backgroundColor: '#fff',
  },

  button: {
    backgroundColor: '#111',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: BR_BORDER,
    ...BR_SHADOW,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  signOut: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    color: '#a00',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  map: {
    height: 180,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: BR_BORDER,
    overflow: 'hidden',
  },
  mapPreviewWrap: { position: 'relative', marginTop: 12 },
  mapPreviewOverlay: {
    position: 'absolute',
    inset: 0 as unknown as number,
    backgroundColor: 'transparent',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 10,
  },
  mapPreviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#111',
    borderWidth: 1.5,
    borderColor: BR_BORDER,
  },
  mapPreviewBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  mapHelper: { marginTop: 8, color: '#666', fontSize: 12 },
  mapOpenButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: BR_YELLOW,
    borderWidth: 2,
    borderColor: BR_BORDER,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  mapOpenButtonText: {
    color: '#111',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mapEmpty: {
    marginTop: 12,
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff8d6',
    borderWidth: 2,
    borderColor: BR_BORDER,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mapEmptyText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  locationButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: BR_YELLOW,
    borderWidth: 2,
    borderColor: BR_BORDER,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationButtonText: {
    color: '#111',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
