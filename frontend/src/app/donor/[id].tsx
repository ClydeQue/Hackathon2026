import { useEffect, useRef, useState } from 'react';
import {
  Animated,
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

const INK   = '#0F1117';
const CREAM  = '#EEF4FB';
const PAPER  = '#DCEAF6';
const LIME   = '#F4FF61';
const PINK   = '#2A6FDB';
const CORAL  = '#FF5C4D';
const SUN    = '#FFAE2D';
const CYAN   = '#5BA3E8';

type Status = 'available' | 'reserved' | 'picked_up' | 'unavailable';

function deriveStatus(item: ClothingItem): Status {
  if (item.status !== 'donate') return 'unavailable';
  if (item.claimed_at) return 'reserved';
  return 'available';
}

const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  available:   { label: 'Available',           bg: LIME,  fg: INK  },
  reserved:    { label: 'Reserved',            bg: SUN,   fg: INK  },
  picked_up:   { label: 'Picked up',           bg: PAPER, fg: INK  },
  unavailable: { label: 'No longer available', bg: CORAL, fg: CREAM },
};

export default function DonorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ClothingItem | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      setLoading(true); setError(null);
      const { data: itemRow, error: itemErr } = await supabase.from('clothing_items').select('*').eq('id', id).single();
      if (cancelled) return;
      if (itemErr || !itemRow) { setError(itemErr?.message ?? 'Item not found.'); setLoading(false); return; }
      setItem(itemRow as ClothingItem);
      const { data: profileRow, error: profErr } = await supabase.from('profiles').select('*').eq('user_id', (itemRow as ClothingItem).owner_id).single();
      if (cancelled) return;
      if (profErr || !profileRow) { setError(profErr?.message ?? 'Donor profile not found.'); setLoading(false); return; }
      setProfile(profileRow as Profile);
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <View style={s.center}>
        <Stack.Screen options={{ headerShown: true, title: 'Donor' }} />
        <Spinner />
      </View>
    );
  }

  if (error || !item || !profile) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <Stack.Screen options={{ headerShown: true, title: 'Donor' }} />
        <View style={s.center}>
          <Text style={s.errorText}>{error ?? 'Something went wrong.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = deriveStatus(item);
  const meta = STATUS_META[status];
  const hasLocation = profile.latitude != null && profile.longitude != null;
  const initials = (profile.display_name || '?')
    .split(/\s+/).map((seg) => seg[0]?.toUpperCase() ?? '').join('').slice(0, 2);

  const openMaps = () => {
    const lat = profile.latitude!;
    const lng = profile.longitude!;
    const label = encodeURIComponent(profile.display_name || 'Pickup');
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`
      : `https://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: profile.display_name || 'Donor',
          headerStyle: { backgroundColor: CREAM },
          headerTitleStyle: { fontFamily: 'WorkSans', fontWeight: '900', color: INK },
          headerShadowVisible: false,
        }}
      />
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {/* Header card */}
        <View style={s.headerCard}>
          {profile.avatar_url ? (
            <Image
              source={{ uri: avatarPublicUrl(profile.avatar_url), cacheKey: profile.avatar_url }}
              style={s.avatar} contentFit="cover"
            />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{profile.display_name || 'Someone'}</Text>
            <View style={[s.statusPill, { backgroundColor: meta.bg }]}>
              <Text style={[s.statusText, { color: meta.fg }]}>{meta.label}</Text>
            </View>
          </View>
        </View>

        {/* Map */}
        <View style={s.mapWrap}>
          {hasLocation ? (
            <>
              <MapPin
                latitude={profile.latitude!}
                longitude={profile.longitude!}
                label={profile.display_name || 'Pickup'}
                style={s.map}
              />
              <Pressable style={s.mapBtn} onPress={openMaps}>
                <Ionicons name="open-outline" size={15} color={INK} />
                <Text style={s.mapBtnText}>Open in Apple Maps</Text>
              </Pressable>
            </>
          ) : (
            <View style={s.mapEmpty}>
              <Ionicons name="location-outline" size={32} color={`${INK}55`} />
              <Text style={s.mapHint}>No pickup point set</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: CORAL, textAlign: 'center', fontFamily: 'WorkSans', fontWeight: '700' },

  headerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 18, paddingVertical: 16,
  },
  avatar: {
    width: 56, height: 56,
    borderWidth: 3, borderColor: INK,
    backgroundColor: PAPER,
    shadowColor: INK, shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitials: {
    fontFamily: 'CherryBombOne-Regular',
    fontSize: 22, color: INK,
  },
  name: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 20, color: INK, marginBottom: 6,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 2, borderColor: INK,
  },
  statusText: {
    fontFamily: 'WorkSans', fontWeight: '800',
    fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
  },

  mapWrap: { flex: 1, margin: 16, gap: 10 },
  map: {
    flex: 1,
    borderWidth: 3, borderColor: INK,
    minHeight: 220,
    shadowColor: INK, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  mapBtn: {
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: PAPER,
    borderWidth: 3, borderColor: INK,
    flexDirection: 'row', gap: 6, alignItems: 'center',
    alignSelf: 'flex-start',
    shadowColor: INK, shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  mapBtnText: {
    color: INK, fontFamily: 'WorkSans',
    fontWeight: '700', fontSize: 13,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  mapEmpty: {
    flex: 1,
    backgroundColor: PAPER,
    borderWidth: 3, borderColor: INK,
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  mapHint: {
    color: INK, opacity: 0.5,
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5,
  },
});
