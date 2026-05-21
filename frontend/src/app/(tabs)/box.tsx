import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Spinner } from '@/components/Spinner';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ItemTile } from '@/components/ItemTile';
import { signedPhotoUrl, supabase } from '@/lib/supabase';
import type { ClothingItem, Profile } from '@/types';

type DonationStatus = 'pending' | 'accepted' | 'received' | 'declined';
type BoxView = 'outgoing' | 'incoming';

type Party = Pick<
  Profile,
  | 'user_id'
  | 'display_name'
  | 'contact_email'
  | 'contact_phone'
  | 'contact_handle'
  | 'latitude'
  | 'longitude'
>;

type OutgoingItem = ClothingItem & {
  swipe_id: string;
  swipe_status: DonationStatus;
};

type OutgoingBundle = {
  donor: Party;
  items: OutgoingItem[];
};

type Requester = {
  swipe_id: string;
  swipe_status: DonationStatus;
  profile: Party;
};

type IncomingBundle = {
  item: ClothingItem;
  requesters: Requester[];
};

const STATUS_ORDER: Record<DonationStatus, number> = {
  pending: 0,
  accepted: 1,
  received: 2,
  declined: 3,
};

const STATUS_STYLE: Record<DonationStatus, { bg: string; fg: string; label: string }> = {
  pending:  { bg: '#FFAE2D', fg: '#0F1117', label: 'Pending'  },
  accepted: { bg: '#5BA3E8', fg: '#EEF4FB', label: 'Accepted' },
  received: { bg: '#0F1117', fg: '#F4FF61', label: 'Received' },
  declined: { bg: '#EEF4FB', fg: '#0F1117', label: 'Declined' },
};

function StatusPill({ status }: { status: DonationStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusPillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

function pretty(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/_/g, ' ').trim();
}

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return 'Expired';
  if (diffDays === 0) return 'Pickup today';
  if (diffDays === 1) return 'Pickup tomorrow';
  if (diffDays < 7) return `Pickup in ${diffDays} days`;
  return `Pickup by ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

const INK   = '#0F1117';
const CREAM  = '#EEF4FB';
const PAPER  = '#DCEAF6';
const LIME   = '#F4FF61';
const PINK   = '#2A6FDB';
const SUN    = '#FFAE2D';
const CYAN   = '#5BA3E8';
const SMOKE  = '#C8DBF0';

export default function Box() {
  const router = useRouter();
  const [view, setView] = useState<BoxView>('outgoing');
  const [outgoing, setOutgoing] = useState<OutgoingBundle[]>([]);
  const [incoming, setIncoming] = useState<IncomingBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactFor, setContactFor] = useState<Party | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLoading(false);
      return;
    }

    // ---- Outgoing: right-swipes I authored ---------------------------
    const { data: outRows, error: outErr } = await supabase
      .from('swipes')
      .select('id, status, item:clothing_items(*)')
      .eq('swiper_id', u.user.id)
      .eq('direction', 'right');
    if (outErr) {
      Alert.alert('Box error', outErr.message);
      setLoading(false);
      return;
    }

    const outItems: OutgoingItem[] = (outRows ?? [])
      .map((r: any) => {
        const item = r.item as ClothingItem | null;
        if (!item) return null;
        return {
          ...item,
          swipe_id: r.id as string,
          swipe_status: (r.status ?? 'pending') as DonationStatus,
        };
      })
      .filter((x): x is OutgoingItem => !!x);

    const donorIds = Array.from(new Set(outItems.map((i) => i.owner_id)));

    // ---- Incoming: right-swipes on items I own -----------------------
    const { data: inRows, error: inErr } = await supabase
      .from('swipes')
      .select('id, status, swiper_id, item:clothing_items!inner(*)')
      .eq('direction', 'right')
      .eq('item.owner_id', u.user.id);
    if (inErr) {
      Alert.alert('Box error', inErr.message);
      setLoading(false);
      return;
    }

    const incomingFlat = (inRows ?? [])
      .map((r: any) => {
        const item = r.item as ClothingItem | null;
        if (!item) return null;
        return {
          item,
          swipe_id: r.id as string,
          swiper_id: r.swiper_id as string,
          swipe_status: (r.status ?? 'pending') as DonationStatus,
        };
      })
      .filter(Boolean) as Array<{
        item: ClothingItem;
        swipe_id: string;
        swiper_id: string;
        swipe_status: DonationStatus;
      }>;

    const requesterIds = Array.from(new Set(incomingFlat.map((r) => r.swiper_id)));

    // ---- One batched profile lookup for both sides -------------------
    const profileById = new Map<string, Party>();
    const profileIds = Array.from(new Set([...donorIds, ...requesterIds]));
    if (profileIds.length > 0) {
      const { data: profileRows, error: profileErr } = await supabase
        .from('profiles')
        .select(
          'user_id,display_name,contact_email,contact_phone,contact_handle,latitude,longitude',
        )
        .in('user_id', profileIds);
      if (profileErr) {
        Alert.alert('Box error', profileErr.message);
        setLoading(false);
        return;
      }
      for (const p of profileRows ?? []) profileById.set(p.user_id, p as Party);
    }
    const fallbackParty = (id: string): Party => ({
      user_id: id,
      display_name: 'Someone',
      contact_email: null,
      contact_phone: null,
      contact_handle: null,
      latitude: null,
      longitude: null,
    });

    // ---- Bundle outgoing by donor ------------------------------------
    const outByDonor = new Map<string, OutgoingBundle>();
    for (const item of outItems) {
      const donor = profileById.get(item.owner_id) ?? fallbackParty(item.owner_id);
      if (!outByDonor.has(donor.user_id)) {
        outByDonor.set(donor.user_id, { donor, items: [] });
      }
      outByDonor.get(donor.user_id)!.items.push(item);
    }
    for (const b of outByDonor.values()) {
      b.items.sort(
        (a, b) => STATUS_ORDER[a.swipe_status] - STATUS_ORDER[b.swipe_status],
      );
    }
    setOutgoing(Array.from(outByDonor.values()));

    // ---- Bundle incoming by item -------------------------------------
    const inByItem = new Map<string, IncomingBundle>();
    for (const r of incomingFlat) {
      if (!inByItem.has(r.item.id)) {
        inByItem.set(r.item.id, { item: r.item, requesters: [] });
      }
      const profile = profileById.get(r.swiper_id) ?? fallbackParty(r.swiper_id);
      inByItem.get(r.item.id)!.requesters.push({
        swipe_id: r.swipe_id,
        swipe_status: r.swipe_status,
        profile,
      });
    }
    for (const b of inByItem.values()) {
      b.requesters.sort(
        (a, b) => STATUS_ORDER[a.swipe_status] - STATUS_ORDER[b.swipe_status],
      );
    }
    setIncoming(Array.from(inByItem.values()));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function setSwipeStatus(swipeId: string, status: DonationStatus) {
    const { error } = await supabase
      .from('swipes')
      .update({ status })
      .eq('id', swipeId);
    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }
    // Reload — the accepted-cascade trigger may have flipped siblings.
    load();
  }

  const incomingCount = useMemo(
    () =>
      incoming.reduce(
        (n, b) => n + b.requesters.filter((r) => r.swipe_status === 'pending').length,
        0,
      ),
    [incoming],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <Spinner />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.eyebrow}>YOUR BOX</Text>
          <Text style={styles.pageTitle}>
            You <Text style={styles.pageTitleEm}>loved</Text>
          </Text>
        </View>
        {incomingCount > 0 && (
          <View style={styles.newMatchBadge}>
            <Text style={styles.newMatchText}>{incomingCount} incoming</Text>
          </View>
        )}
      </View>

      {/* Tab toggle */}
      <View style={styles.viewPills}>
        <Pressable
          onPress={() => setView('outgoing')}
          style={[styles.viewPill, view === 'outgoing' && styles.viewPillActive]}
        >
          <Text
            style={[styles.viewPillText, view === 'outgoing' && styles.viewPillTextActive]}
          >
            Claimed
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setView('incoming')}
          style={[styles.viewPill, view === 'incoming' && styles.viewPillActive]}
        >
          <Text
            style={[styles.viewPillText, view === 'incoming' && styles.viewPillTextActive]}
          >
            Requests{incomingCount > 0 ? ` · ${incomingCount}` : ''}
          </Text>
        </Pressable>
      </View>

      {view === 'outgoing' ? (
        <OutgoingList
          bundles={outgoing}
          onCancel={(swipeId) => setSwipeStatus(swipeId, 'declined')}
          onReceived={(swipeId) => setSwipeStatus(swipeId, 'received')}
          onContact={(donor) => setContactFor(donor)}
          onOpenItem={(itemId) => router.push(`/donor/${itemId}`)}
        />
      ) : (
        <IncomingList
          bundles={incoming}
          onAccept={(swipeId) => setSwipeStatus(swipeId, 'accepted')}
          onDecline={(swipeId) => setSwipeStatus(swipeId, 'declined')}
          onContact={(p) => setContactFor(p)}
        />
      )}

      <ContactSheet party={contactFor} onClose={() => setContactFor(null)} />
    </SafeAreaView>
  );
}

// =====================================================================
// Outgoing
// =====================================================================

function OutgoingList({
  bundles,
  onCancel,
  onReceived,
  onContact,
  onOpenItem,
}: {
  bundles: OutgoingBundle[];
  onCancel: (swipeId: string) => void;
  onReceived: (swipeId: string) => void;
  onContact: (donor: Party) => void;
  onOpenItem: (itemId: string) => void;
}) {
  if (bundles.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Nothing requested yet.</Text>
        <Text style={styles.emptyBody}>Head to Discover and swipe right on what you love.</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={bundles}
      keyExtractor={(b) => b.donor.user_id}
      contentContainerStyle={{ padding: 12 }}
      renderItem={({ item: bundle }) => {
        const hasPickup =
          bundle.donor.latitude != null && bundle.donor.longitude != null;
        const firstItemId = bundle.items[0]?.id;
        return (
        <View style={styles.bundle}>
          <View style={styles.bundleHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.donor} numberOfLines={1}>
                {bundle.donor.display_name}
              </Text>
              <Pressable
                style={styles.pickupRow}
                disabled={!hasPickup || !firstItemId}
                onPress={() => firstItemId && onOpenItem(firstItemId)}
              >
                <Ionicons
                  name={hasPickup ? 'location' : 'location-outline'}
                  size={13}
                  color={hasPickup ? '#0a6b2c' : '#999'}
                />
                <Text
                  style={[
                    styles.pickupText,
                    { color: hasPickup ? '#0a6b2c' : '#999' },
                  ]}
                  numberOfLines={1}
                >
                  {hasPickup
                    ? `Pickup ${bundle.donor.latitude!.toFixed(3)}, ${bundle.donor.longitude!.toFixed(3)} — view map`
                    : 'No pickup point set'}
                </Text>
              </Pressable>
            </View>
          </View>
          {bundle.items.map((item) => {
            // Brand on its own line, with category · color as a subtitle
            // underneath. The duplicate brand label under the photo is
            // gone (ItemTile is in imageOnly mode).
            const title = item.listing_title?.trim() || item.brand || null;
            const subtitle = [item.category, item.color]
              .filter((x): x is string => !!x)
              .join(' · ');
            const pills = [
              pretty(item.condition),
              item.size,
              pretty(item.gender),
            ].filter((x): x is string => !!x);
            const deadline = formatDeadline(item.available_until);
            return (
              <View key={item.swipe_id} style={styles.outgoingRow}>
                <View style={styles.statusCorner}>
                  <StatusPill status={item.swipe_status} />
                </View>
                <View style={styles.outgoingTile}>
                  <ItemTile
                    item={item}
                    onPress={() => onOpenItem(item.id)}
                    imageOnly
                  />
                </View>
                <View style={styles.outgoingMeta}>
                  {title ? (
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {title}
                    </Text>
                  ) : null}
                  {subtitle ? (
                    <Text style={styles.itemSubtitle} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  ) : null}
                  {pills.length > 0 ? (
                    <View style={styles.pillRow}>
                      {pills.map((p) => (
                        <View key={p} style={styles.metaPill}>
                          <Text style={styles.metaPillText}>{p}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {item.pickup_note?.trim() ? (
                    <Text style={styles.pickupNote} numberOfLines={2}>
                      📍 {item.pickup_note.trim()}
                    </Text>
                  ) : null}
                  {deadline ? (
                    <Text style={styles.deadline}>{deadline}</Text>
                  ) : null}
                  {item.swipe_status === 'pending' ? (
                    <Pressable
                      style={[styles.action, styles.actionMuted]}
                      onPress={() => onCancel(item.swipe_id)}
                    >
                      <Text style={styles.actionMutedText}>Cancel request</Text>
                    </Pressable>
                  ) : null}
                  {item.swipe_status === 'accepted' ? (
                    <Pressable
                      style={[styles.action, styles.actionPrimary]}
                      onPress={() => onReceived(item.swipe_id)}
                    >
                      <Text style={styles.actionPrimaryText}>Mark as received</Text>
                    </Pressable>
                  ) : null}
                  {item.swipe_status === 'received' ? (
                    <Text style={styles.muted}>Hand-off complete.</Text>
                  ) : null}
                  {item.swipe_status === 'declined' ? (
                    <Text style={styles.muted}>No longer available.</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
          <Pressable
            style={styles.contactWide}
            onPress={() => onContact(bundle.donor)}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
            <Text style={styles.contactText}>
              Contact {bundle.donor.display_name}
            </Text>
          </Pressable>
        </View>
        );
      }}
    />
  );
}

// =====================================================================
// Incoming
// =====================================================================

function ItemThumb({ item }: { item: ClothingItem }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    signedPhotoUrl(item.photo_path)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [item.photo_path]);
  return (
    <View style={styles.thumb}>
      {url ? (
        <Image
          source={{ uri: url, cacheKey: item.photo_path }}
          style={styles.thumbImg}
          contentFit="cover"
          transition={150}
        />
      ) : null}
    </View>
  );
}

function IncomingList({
  bundles,
  onAccept,
  onDecline,
  onContact,
}: {
  bundles: IncomingBundle[];
  onAccept: (swipeId: string) => void;
  onDecline: (swipeId: string) => void;
  onContact: (p: Party) => void;
}) {
  if (bundles.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No requests on your items.</Text>
        <Text style={styles.emptyBody}>
          When someone swipes right on a donated piece, you'll see them here.
        </Text>
      </View>
    );
  }

  function confirmAccept(swipeId: string, requesterName: string, pendingCount: number) {
    if (pendingCount <= 1) {
      onAccept(swipeId);
      return;
    }
    Alert.alert(
      `Accept ${requesterName}?`,
      `${pendingCount - 1} other pending request${pendingCount - 1 === 1 ? '' : 's'} on this item will be declined.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept', onPress: () => onAccept(swipeId) },
      ],
    );
  }

  return (
    <FlatList
      data={bundles}
      keyExtractor={(b) => b.item.id}
      contentContainerStyle={{ padding: 12 }}
      renderItem={({ item: bundle }) => {
        const pendingCount = bundle.requesters.filter(
          (r) => r.swipe_status === 'pending',
        ).length;
        return (
          <View style={styles.bundle}>
            <View style={styles.bundleHeader}>
              <ItemThumb item={bundle.item} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.donor} numberOfLines={1}>
                  {bundle.item.brand ?? bundle.item.category}
                </Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {bundle.requesters.length} request
                  {bundle.requesters.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
            {bundle.requesters.map((r) => (
              <View key={r.swipe_id} style={styles.requesterRow}>
                <View style={{ flex: 1 }}>
                  <Pressable onPress={() => onContact(r.profile)}>
                    <Text style={styles.requesterName}>{r.profile.display_name}</Text>
                  </Pressable>
                  <View style={{ marginTop: 4 }}>
                    <StatusPill status={r.swipe_status} />
                  </View>
                </View>
                <View style={styles.requesterActions}>
                  {r.swipe_status === 'pending' ? (
                    <>
                      <Pressable
                        style={[styles.action, styles.actionMuted]}
                        onPress={() => onDecline(r.swipe_id)}
                      >
                        <Text style={styles.actionMutedText}>Decline</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.action, styles.actionPrimary]}
                        onPress={() =>
                          confirmAccept(r.swipe_id, r.profile.display_name, pendingCount)
                        }
                      >
                        <Text style={styles.actionPrimaryText}>Accept</Text>
                      </Pressable>
                    </>
                  ) : null}
                  {r.swipe_status === 'accepted' ? (
                    <Pressable
                      style={[styles.action, styles.actionMuted]}
                      onPress={() => onDecline(r.swipe_id)}
                    >
                      <Text style={styles.actionMutedText}>Cancel</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        );
      }}
    />
  );
}

// =====================================================================
// Contact sheet — reused for donor (Outgoing) and requester (Incoming)
// =====================================================================

function ContactSheet({
  party,
  onClose,
}: {
  party: Party | null;
  onClose: () => void;
}) {
  if (!party) return null;
  const rows: { label: string; value: string; action?: () => void }[] = [];

  if (party.contact_email) {
    rows.push({
      label: 'Email',
      value: party.contact_email,
      action: () => Linking.openURL(`mailto:${party.contact_email}`),
    });
  }
  if (party.contact_phone) {
    rows.push({
      label: 'Phone',
      value: party.contact_phone,
      action: () => Linking.openURL(`tel:${party.contact_phone}`),
    });
  }
  if (party.contact_handle) {
    rows.push({ label: 'Handle', value: party.contact_handle });
  }

  return (
    <Modal animationType="slide" transparent visible={!!party} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{party.display_name}</Text>
          {rows.length === 0 ? (
            <Text style={styles.sheetEmpty}>
              They haven't shared any contact info.
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
  container: { flex: 1, backgroundColor: CREAM },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 18, color: INK,
  },
  emptyBody: {
    fontFamily: 'WorkSans', fontWeight: '500',
    color: INK, opacity: 0.6, marginTop: 6, textAlign: 'center', fontSize: 13,
  },

  // ── WearAble header ───────────────────────────────────────────────────
  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 3, borderBottomColor: INK,
    backgroundColor: CREAM,
  },
  eyebrow: {
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 10, color: INK, opacity: 0.6,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  pageTitle: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 26, color: INK, lineHeight: 30, marginTop: 2,
    letterSpacing: -0.3,
  },
  pageTitleEm: {
    fontFamily: 'CherryBombOne-Regular',
    fontSize: 28, color: PINK,
  },
  newMatchBadge: {
    paddingVertical: 5, paddingHorizontal: 10,
    backgroundColor: PINK,
    borderWidth: 3, borderColor: INK,
    shadowColor: INK, shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1, shadowRadius: 0,
    transform: [{ rotate: '2deg' }],
  },
  newMatchText: {
    color: CREAM, fontFamily: 'WorkSans',
    fontWeight: '900', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  // ── Tab toggle ────────────────────────────────────────────────────────
  viewPills: {
    flexDirection: 'row',
    borderBottomWidth: 3, borderBottomColor: INK,
    backgroundColor: CREAM,
  },
  viewPill: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: 'transparent',
    borderRightWidth: 2, borderRightColor: INK,
    alignItems: 'center',
  },
  viewPillActive: { backgroundColor: INK },
  viewPillText: {
    color: INK, fontFamily: 'WorkSans',
    fontWeight: '900', fontSize: 12,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  viewPillTextActive: {
    color: LIME, fontFamily: 'WorkSans',
    fontWeight: '900', fontSize: 12,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // ── Bundles / cards ───────────────────────────────────────────────────
  bundle: {
    marginBottom: 14,
    backgroundColor: '#fff',
    padding: 14,
    borderWidth: 3, borderColor: INK,
    shadowColor: INK, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  bundleHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4, marginBottom: 8, gap: 8,
  },
  donor: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 16, color: INK, textTransform: 'capitalize',
  },
  pickupRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  pickupText: {
    fontFamily: 'WorkSans', fontWeight: '600',
    fontSize: 11, color: INK,
  },
  contact: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: INK,
    borderWidth: 3, borderColor: INK,
  },
  contactText: {
    color: LIME, fontFamily: 'WorkSans',
    fontWeight: '900', fontSize: 13,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  outgoingRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 8, gap: 12, position: 'relative',
  },
  outgoingTile: { width: 110 },
  outgoingMeta: {
    flex: 1, justifyContent: 'flex-start',
    gap: 6, paddingTop: 2, paddingRight: 72,
  },
  statusCorner: { position: 'absolute', top: 4, right: 4, zIndex: 2 },
  contactWide: {
    marginTop: 14,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: INK,
    borderWidth: 3, borderColor: INK,
    shadowColor: INK, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  itemTitle: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 16, color: INK, textTransform: 'capitalize',
  },
  itemSubtitle: {
    fontFamily: 'WorkSans', fontWeight: '500',
    color: INK, opacity: 0.65, fontSize: 13, textTransform: 'capitalize',
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  metaPill: {
    paddingVertical: 3, paddingHorizontal: 8,
    backgroundColor: PAPER,
    borderWidth: 2, borderColor: INK,
  },
  metaPillText: {
    fontFamily: 'WorkSans', fontWeight: '700',
    fontSize: 11, color: INK, textTransform: 'capitalize',
  },
  pickupNote: {
    fontFamily: 'WorkSans', fontWeight: '500',
    color: INK, opacity: 0.65, fontSize: 13, marginTop: 2,
  },
  deadline: {
    fontFamily: 'WorkSans', fontWeight: '700',
    color: SUN, fontSize: 12, marginTop: 2,
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 2, borderColor: INK,
  },
  statusPillText: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase',
  },
  action: {
    paddingVertical: 9, paddingHorizontal: 14,
    alignSelf: 'flex-start',
    borderWidth: 2, borderColor: INK,
    shadowColor: INK, shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  actionPrimary: { backgroundColor: INK },
  actionPrimaryText: {
    color: LIME, fontFamily: 'WorkSans',
    fontWeight: '900', fontSize: 12,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  actionMuted: { backgroundColor: CREAM },
  actionMutedText: {
    color: INK, fontFamily: 'WorkSans',
    fontWeight: '900', fontSize: 12,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  muted: {
    fontFamily: 'WorkSans', fontWeight: '500',
    color: INK, opacity: 0.55, fontSize: 13,
  },
  thumb: {
    width: 56, height: 56,
    backgroundColor: PAPER,
    borderWidth: 2, borderColor: INK,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  requesterRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 2, borderTopColor: INK,
  },
  requesterName: {
    fontFamily: 'WorkSans', fontWeight: '800',
    fontSize: 16, color: INK,
  },
  requesterActions: { flexDirection: 'row', gap: 8 },

  // ── Contact sheet ─────────────────────────────────────────────────────
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: CREAM,
    padding: 24,
    borderTopWidth: 3, borderTopColor: INK,
    borderLeftWidth: 3, borderLeftColor: INK,
    borderRightWidth: 3, borderRightColor: INK,
    gap: 8,
    shadowColor: INK, shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  sheetHandle: {
    width: 60, height: 5, backgroundColor: INK,
    alignSelf: 'center', marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: 'WorkSans', fontWeight: '900',
    fontSize: 22, color: INK, letterSpacing: -0.3,
  },
  sheetEmpty: {
    fontFamily: 'WorkSans', fontWeight: '500',
    color: INK, opacity: 0.65, marginTop: 12, fontSize: 13,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: INK,
  },
  rowLabel: {
    fontFamily: 'WorkSans', fontWeight: '700',
    color: INK, opacity: 0.55, fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  rowValue: {
    fontFamily: 'WorkSans', fontWeight: '800',
    fontSize: 16, color: INK, marginTop: 2,
  },
  close: {
    marginTop: 8, padding: 14,
    backgroundColor: INK,
    borderWidth: 3, borderColor: INK,
    alignItems: 'center',
    shadowColor: INK, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, shadowRadius: 0,
  },
  closeText: {
    color: LIME, fontFamily: 'WorkSans',
    fontWeight: '900', textTransform: 'uppercase',
    letterSpacing: 0.8, fontSize: 13,
  },
});
