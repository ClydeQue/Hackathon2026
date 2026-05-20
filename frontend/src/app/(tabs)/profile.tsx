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
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
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

  async function save() {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: profile.display_name,
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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>Public profile</Text>
        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          value={profile.display_name}
          onChangeText={(t) => update('display_name', t)}
        />

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
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={profile.contact_phone ?? ''}
          onChangeText={(t) => update('contact_phone', t || null)}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Handle (Instagram, etc.)</Text>
        <TextInput
          style={styles.input}
          value={profile.contact_handle ?? ''}
          onChangeText={(t) => update('contact_handle', t || null)}
          autoCapitalize="none"
        />

        <Pressable style={styles.button} onPress={save} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? '…' : 'Save'}</Text>
        </Pressable>

        <Pressable style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, gap: 4 },
  section: { fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 6 },
  label: { fontWeight: '600', marginTop: 8 },
  hint: { color: '#777', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signOut: { marginTop: 24, padding: 12, alignItems: 'center' },
  signOutText: { color: '#a00', fontWeight: '600' },
});
