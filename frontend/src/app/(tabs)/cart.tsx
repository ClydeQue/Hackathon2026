import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ItemTile } from '@/components/ItemTile';
import { supabase } from '@/lib/supabase';
import type { ClothingItem, Profile } from '@/types';

type DonorBundle = {
  donor: Pick<Profile, 'user_id' | 'display_name' | 'contact_email' | 'contact_phone' | 'contact_handle'>;
  items: ClothingItem[];
};

export default function Cart() {
  const [bundles, setBundles] = useState<DonorBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactFor, setContactFor] = useState<DonorBundle | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLoading(false);
      return;
    }

    // 1. Right-swipes with their items.
    const { data: swipeRows, error: swipeErr } = await supabase
      .from('swipes')
      .select('item:clothing_items(*)')
      .eq('swiper_id', u.user.id)
      .eq('direction', 'right');
    if (swipeErr) {
      Alert.alert('Cart error', swipeErr.message);
      setLoading(false);
      return;
    }

    const items = (swipeRows ?? [])
      .map((r) => (r as any).item as ClothingItem | null)
      .filter((i): i is ClothingItem => !!i && i.status === 'donate');

    // 2. Donor profiles in one batched query.
    const ownerIds = Array.from(new Set(items.map((i) => i.owner_id)));
    const donorById = new Map<string, DonorBundle['donor']>();
    if (ownerIds.length > 0) {
      const { data: profileRows, error: profileErr } = await supabase
        .from('profiles')
        .select('user_id,display_name,contact_email,contact_phone,contact_handle')
        .in('user_id', ownerIds);
      if (profileErr) {
        Alert.alert('Cart error', profileErr.message);
        setLoading(false);
        return;
      }
      for (const p of profileRows ?? []) {
        donorById.set(p.user_id, p as DonorBundle['donor']);
      }
    }

    // 3. Bundle by donor.
    const byDonor = new Map<string, DonorBundle>();
    for (const item of items) {
      const donor = donorById.get(item.owner_id) ?? {
        user_id: item.owner_id,
        display_name: 'Someone',
        contact_email: null,
        contact_phone: null,
        contact_handle: null,
      };
      if (!byDonor.has(donor.user_id)) {
        byDonor.set(donor.user_id, { donor, items: [] });
      }
      byDonor.get(donor.user_id)!.items.push(item);
    }
    setBundles(Array.from(byDonor.values()));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (bundles.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Your cart is empty.</Text>
          <Text style={styles.emptyBody}>
            Head to Feed and swipe right on what you love.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={bundles}
        keyExtractor={(b) => b.donor.user_id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item: bundle }) => (
          <View style={styles.bundle}>
            <View style={styles.bundleHeader}>
              <Text style={styles.donor}>{bundle.donor.display_name}</Text>
              <Pressable
                style={styles.contact}
                onPress={() => setContactFor(bundle)}
              >
                <Text style={styles.contactText}>Contact</Text>
              </Pressable>
            </View>
            <FlatList
              data={bundle.items}
              numColumns={2}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => <ItemTile item={item} />}
              scrollEnabled={false}
            />
          </View>
        )}
      />

      <ContactSheet bundle={contactFor} onClose={() => setContactFor(null)} />
    </SafeAreaView>
  );
}

function ContactSheet({
  bundle,
  onClose,
}: {
  bundle: DonorBundle | null;
  onClose: () => void;
}) {
  if (!bundle) return null;
  const { donor } = bundle;
  const rows: { label: string; value: string; action?: () => void }[] = [];

  if (donor.contact_email) {
    rows.push({
      label: 'Email',
      value: donor.contact_email,
      action: () => Linking.openURL(`mailto:${donor.contact_email}`),
    });
  }
  if (donor.contact_phone) {
    rows.push({
      label: 'Phone',
      value: donor.contact_phone,
      action: () => Linking.openURL(`tel:${donor.contact_phone}`),
    });
  }
  if (donor.contact_handle) {
    rows.push({ label: 'Handle', value: donor.contact_handle });
  }

  return (
    <Modal animationType="slide" transparent visible={!!bundle} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{donor.display_name}</Text>
          {rows.length === 0 ? (
            <Text style={styles.sheetEmpty}>
              This donor hasn’t shared any contact info.
            </Text>
          ) : (
            rows.map((r) => (
              <Pressable
                key={r.label}
                style={styles.row}
                onPress={r.action}
                disabled={!r.action}
              >
                <Text style={styles.rowLabel}>{r.label}</Text>
                <Text style={styles.rowValue}>{r.value}</Text>
              </Pressable>
            ))
          )}
          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyBody: { color: '#666', marginTop: 6, textAlign: 'center' },
  bundle: { marginBottom: 20 },
  bundleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  donor: { fontSize: 16, fontWeight: '700' },
  contact: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111',
  },
  contactText: { color: '#fff', fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 8,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  sheetEmpty: { color: '#777', marginTop: 12 },
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#eee',
  },
  rowLabel: { color: '#888', fontSize: 12, textTransform: 'uppercase' },
  rowValue: { fontSize: 16, marginTop: 2 },
  close: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#eee',
    alignItems: 'center',
  },
  closeText: { fontWeight: '600' },
});
