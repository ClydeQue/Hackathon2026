import { useEffect, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Spinner } from '@/components/Spinner';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin } from '@/components/MapPin';
import { avatarPublicUrl, supabase } from '@/lib/supabase';
import type { ClothingItem, Profile } from '@/types';

type Status = 'available' | 'reserved' | 'picked_up' | 'unavailable';

function deriveStatus(item: ClothingItem): Status {
  if (item.status !== 'donate') return 'unavailable';
  if (item.claimed_at) return 'reserved';
  return 'available';
}

function statusLabel(s: Status): string {
  switch (s) {
    case 'available':
      return 'Available';
    case 'reserved':
      return 'Reserved';
    case 'picked_up':
      return 'Picked up';
    case 'unavailable':
      return 'No longer available';
  }
}

function statusColor(s: Status): string {
  switch (s) {
    case 'available':
      return '#0a8';
    case 'reserved':
      return '#c98a00';
    case 'picked_up':
      return '#555';
    case 'unavailable':
      return '#a00';
  }
}

export default function DonorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ClothingItem | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);

      const { data: itemRow, error: itemErr } = await supabase
        .from('clothing_items')
        .select('*')
        .eq('id', id)
        .single();
      if (cancelled) return;
      if (itemErr || !itemRow) {
        setError(itemErr?.message ?? 'Item not found.');
        setLoading(false);
        return;
      }
      setItem(itemRow as ClothingItem);

      const { data: profileRow, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', (itemRow as ClothingItem).owner_id)
        .single();
      if (cancelled) return;
      if (profErr || !profileRow) {
        setError(profErr?.message ?? 'Donor profile not found.');
        setLoading(false);
        return;
      }
      setProfile(profileRow as Profile);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: true, title: 'Donor' }} />
        <Spinner />
      </View>
    );
  }

  if (error || !item || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Stack.Screen options={{ headerShown: true, title: 'Donor' }} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Something went wrong.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = deriveStatus(item);
  const hasLocation = profile.latitude != null && profile.longitude != null;
  const initials = (profile.display_name || '?')
    .split(/\s+/)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{ headerShown: true, title: profile.display_name || 'Donor' }}
      />
      <View style={styles.header}>
        {profile.avatar_url ? (
          <Image
            source={{
              uri: avatarPublicUrl(profile.avatar_url),
              cacheKey: profile.avatar_url,
            }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.display_name || 'Someone'}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[styles.statusDot, { backgroundColor: statusColor(status) }]}
            />
            <Text style={[styles.statusText, { color: statusColor(status) }]}>
              {statusLabel(status)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.mapWrap}>
        {hasLocation ? (
          <>
            <MapPin
              latitude={profile.latitude!}
              longitude={profile.longitude!}
              label={profile.display_name || 'Pickup'}
              style={styles.map}
            />
            <Pressable
              style={styles.mapOpenButton}
              onPress={() => {
                const lat = profile.latitude!;
                const lng = profile.longitude!;
                const label = encodeURIComponent(profile.display_name || 'Pickup');
                const url =
                  Platform.OS === 'ios'
                    ? `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`
                    : `https://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
                Linking.openURL(url).catch(() => {});
              }}
            >
              <Ionicons name="open-outline" size={16} color="#111" />
              <Text style={styles.mapOpenButtonText}>Open in Apple Maps</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.mapEmpty}>
            <Ionicons name="location-outline" size={32} color="#aaa" />
            <Text style={styles.mapHint}>No pickup point set</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#a00', textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    backgroundColor: '#fff',
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#eee' },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 20, fontWeight: '700', color: '#666' },
  headerText: { flex: 1 },
  name: { fontSize: 20, fontWeight: '700' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600' },
  mapWrap: { margin: 16, flex: 1 },
  map: { flex: 1, borderRadius: 16, minHeight: 220 },
  mapOpenButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f3f3f3',
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  mapOpenButtonText: { color: '#111', fontWeight: '600', fontSize: 13 },
  mapEmpty: {
    paddingVertical: 32,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#f5f5f3',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapHint: { color: '#666', fontSize: 13 },
});
