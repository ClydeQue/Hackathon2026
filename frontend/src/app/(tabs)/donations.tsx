import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Spinner } from '@/components/Spinner';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DM_SERIF } from '@/lib/fonts';
import { signedPhotoUrl, supabase } from '@/lib/supabase';
import type { ClothingItem } from '@/types';

type Section = {
  key: 'drafts' | 'listed';
  title: string;
  hint: string;
  data: ClothingItem[];
};

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function StatCard({
  value,
  label,
  accent,
  tint,
}: {
  value: number | string;
  label: string;
  accent: string;
  tint: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: tint }]}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Thumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      signedPhotoUrl(path)
        .then((u) => {
          if (!cancelled) setUrl(u);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [path]),
  );
  return (
    <View style={styles.thumb}>
      {url ? (
        <Image
          source={{ uri: url, cacheKey: path }}
          style={styles.thumbImg}
          contentFit="cover"
          transition={150}
        />
      ) : null}
    </View>
  );
}

export default function Donations() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<ClothingItem[]>([]);
  const [listed, setListed] = useState<ClothingItem[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [interestedCount, setInterestedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const userId = u.user.id;

    // Fire the three reads in parallel — they're independent.
    const [itemsRes, completedRes, interestedRes] = await Promise.all([
      supabase
        .from('clothing_items')
        .select('*')
        .eq('owner_id', userId)
        .eq('status', 'donate')
        .order('updated_at', { ascending: false }),
      // Donations completed = items the user owned that ended up claimed.
      supabase
        .from('clothing_items')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .not('claimed_at', 'is', null),
      // Interested = open right-swipes (pending requests) on items the user
      // currently owns. !inner forces a filterable join on the items table.
      supabase
        .from('swipes')
        .select('id, item:clothing_items!inner(owner_id)', {
          count: 'exact',
          head: true,
        })
        .eq('direction', 'right')
        .eq('status', 'pending')
        .eq('item.owner_id', userId),
    ]);

    if (itemsRes.error) {
      console.warn('[donations] load failed', itemsRes.error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const rows = (itemsRes.data ?? []) as ClothingItem[];
    setDrafts(rows.filter((r) => !r.listed_at));
    setListed(rows.filter((r) => !!r.listed_at));
    setCompletedCount(completedRes.count ?? 0);
    setInterestedCount(interestedRes.count ?? 0);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const sections: Section[] = [];
  if (drafts.length > 0) {
    sections.push({
      key: 'drafts',
      title: `Drafts · ${drafts.length}`,
      hint: 'Finish these so recipients can find them.',
      data: drafts,
    });
  }
  if (listed.length > 0) {
    sections.push({
      key: 'listed',
      title: `Live in Discover · ${listed.length}`,
      hint: 'Currently visible to others.',
      data: listed,
    });
  }

  const totalDonations = drafts.length + listed.length;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Donations</Text>
        <Text style={styles.subtitle}>
          {totalDonations === 0
            ? 'Items you mark for donation show up here.'
            : `${totalDonations} item${totalDonations === 1 ? '' : 's'} on the way out.`}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard
          value={completedCount}
          label="Donated"
          accent="#0a7f33"
          tint="#e6f6ec"
        />
        <StatCard
          value={interestedCount}
          label="Interested"
          accent="#a8266b"
          tint="#fbe7f0"
        />
        <StatCard
          value={listed.length}
          label="Listed"
          accent="#0a4a8a"
          tint="#e3eefb"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <Spinner />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="gift-outline" size={36} color="#888" />
          </View>
          <Text style={styles.emptyTitle}>No donations yet.</Text>
          <Text style={styles.emptyBody}>
            Open an item in your closet and tap “Donate”. You'll be asked for a
            short description and pickup details before it goes live in
            Discover.
          </Text>
          <Pressable
            style={styles.cta}
            onPress={() => router.push('/(tabs)')}
          >
            <Ionicons name="shirt-outline" size={18} color="#fff" />
            <Text style={styles.ctaText}>Browse closet</Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionHint}>{section.hint}</Text>
            </View>
          )}
          renderItem={({ item, section }) => {
            const isDraft = section.key === 'drafts';
            const title =
              item.listing_title?.trim() || item.brand || item.category;
            const meta = [
              item.color,
              item.category,
              item.condition?.replace('_', ' '),
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <Pressable
                style={styles.row}
                onPress={() => router.push(`/donate/${item.id}`)}
              >
                <Thumb path={item.photo_path} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {meta}
                  </Text>
                  <View
                    style={[
                      styles.pill,
                      isDraft ? styles.pillDraft : styles.pillListed,
                    ]}
                  >
                    {isDraft ? null : (
                      <Ionicons name="checkmark-circle" size={12} color="#0a7f33" />
                    )}
                    <Text
                      style={
                        isDraft ? styles.pillDraftText : styles.pillListedText
                      }
                    >
                      {isDraft ? 'Draft — needs details' : 'Listed'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#aaa" />
              </Pressable>
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// Brutalist tokens shared with profile: thick black borders, hard offset
// shadows, warm off-white background, red & yellow accents.
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
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  title: { fontSize: 36, fontFamily: DM_SERIF.regular, color: '#111' },
  subtitle: { color: '#444', marginTop: 4, fontSize: 14, fontWeight: '500' },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 4,
    borderWidth: 2,
    borderColor: BR_BORDER,
    ...BR_SHADOW,
  },
  statValue: { fontSize: 26, fontWeight: '900' },
  statLabel: {
    fontSize: 10,
    color: '#111',
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  analyticsBlock: { paddingHorizontal: 20, gap: 14, paddingBottom: 10 },

  breakdownCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: BR_BORDER,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    ...BR_SHADOW,
  },
  breakdownTitle: {
    alignSelf: 'flex-start',
    color: '#fff',
    backgroundColor: BR_RED,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  breakdownBar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#eee',
    borderWidth: 1.5,
    borderColor: BR_BORDER,
  },
  breakdownSeg: { height: '100%' },
  segDraft: { backgroundColor: BR_YELLOW },
  segListed: { backgroundColor: '#3d8df4' },
  segDone: { backgroundColor: '#0a7f33' },
  segEmpty: { backgroundColor: '#eee' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: BR_BORDER,
  },
  legendText: {
    fontSize: 11,
    color: '#444',
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  legendCount: { color: '#111', fontWeight: '900' },

  chartCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: BR_BORDER,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    ...BR_SHADOW,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  chartHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 0,
    backgroundColor: BR_YELLOW,
    borderWidth: 1.5,
    borderColor: BR_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartTitle: {
    alignSelf: 'flex-start',
    color: '#fff',
    backgroundColor: BR_RED,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  chartSub: { fontSize: 13, color: '#444', marginTop: 6, fontWeight: '600' },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 110,
    gap: 8,
    marginTop: 6,
  },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  chartBarTrack: {
    width: '100%',
    height: 70,
    backgroundColor: '#fff8d6',
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: BR_BORDER,
    justifyContent: 'flex-end',
  },
  chartBarFill: { width: '100%', borderRadius: 0 },
  chartBarLabel: {
    fontSize: 10,
    color: '#444',
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chartBarCount: { fontSize: 12, color: '#111', fontWeight: '900' },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 0,
    backgroundColor: BR_YELLOW,
    borderWidth: 2,
    borderColor: BR_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...BR_SHADOW,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: DM_SERIF.regular,
  },
  emptyBody: {
    textAlign: 'center',
    color: '#444',
    marginTop: 8,
    lineHeight: 20,
    fontSize: 14,
  },
  cta: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: BR_BORDER,
    ...BR_SHADOW,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },

  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
    gap: 4,
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    color: '#fff',
    backgroundColor: BR_RED,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  sectionHint: { color: '#666', fontSize: 12, marginTop: 2, fontWeight: '500' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: BR_BORDER,
    borderRadius: 10,
    ...BR_SHADOW,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#eee',
    borderWidth: 1.5,
    borderColor: BR_BORDER,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'capitalize',
    color: '#111',
  },
  rowMeta: {
    color: '#666',
    fontSize: 12,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: BR_BORDER,
  },
  pillDraft: { backgroundColor: BR_YELLOW },
  pillDraftText: {
    color: '#111',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  pillListed: { backgroundColor: '#cfe8d3' },
  pillListedText: {
    color: '#0a4a1f',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
