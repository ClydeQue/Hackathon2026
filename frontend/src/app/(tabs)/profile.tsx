import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { readAsStringAsync } from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AVATAR_BUCKET, avatarPublicUrl, supabase } from '@/lib/supabase';
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
        <ActivityIndicator />
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
                <ActivityIndicator size="small" color="#fff" />
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
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 112;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginTop: 8, marginBottom: 4 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#eee',
  },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 36, fontWeight: '700', color: '#666' },
  avatarEdit: {
    position: 'absolute',
    right: 0,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#111',
    borderWidth: 3,
    borderColor: '#fafafa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 14,
    maxWidth: '90%',
  },
  email: { color: '#777', marginTop: 2 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  section: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  label: { fontWeight: '600', marginTop: 12, color: '#333' },
  hint: { color: '#777', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginTop: 6,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signOut: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { color: '#a00', fontWeight: '600' },
});
