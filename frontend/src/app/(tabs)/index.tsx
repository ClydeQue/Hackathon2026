import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ItemTile } from '@/components/ItemTile';
import { invalidateSignedPhotoUrl, STORAGE_BUCKET, supabase } from '@/lib/supabase';
import type { ClothingItem, Collection, ItemStatus } from '@/types';

const FILTERS: ItemStatus[] = ['keep', 'archive', 'donate'];

export default function Catalogue() {
  const [filter, setFilter] = useState<ItemStatus>('keep');
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
    null,
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    const { data: session } = await supabase.auth.getUser();
    if (!session.user) return;

    // Collection selected → show every item in that collection regardless of
    // status (collections can hold keep / archive / donate items, since
    // new.tsx assigns from the full closet). The status pills are hidden
    // while a collection is active to avoid the contradictory state.
    if (selectedCollectionId) {
      // archived_at IS NULL → only the active shelf. Items shelved inside
      // the collection live under the collection detail page.
      const { data: memberRows } = await supabase
        .from('collection_items')
        .select('item_id, archived_at, clothing_items(*)')
        .eq('collection_id', selectedCollectionId)
        .is('archived_at', null);
      const rows = ((memberRows ?? []) as any[])
        .map((r) => r.clothing_items as ClothingItem)
        .filter(Boolean)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setItems(rows);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data, error } = await supabase
      .from('clothing_items')
      .select('*')
      .eq('owner_id', session.user.id)
      .eq('status', filter)
      .order('created_at', { ascending: false });
    if (!error && data) setItems(data as ClothingItem[]);
    setLoading(false);
    setRefreshing(false);
  }, [filter, selectedCollectionId]);

  const loadCollections = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase
      .from('collections')
      .select('*')
      .eq('owner_id', u.user.id)
      .order('created_at', { ascending: false });
    if (data) setCollections(data as Collection[]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
      loadCollections();
    }, [load, loadCollections]),
  );

  const selectedCollectionName =
    selectedCollectionId
      ? collections.find((c) => c.id === selectedCollectionId)?.name ?? 'Collection'
      : null;

  function confirmDelete(item: ClothingItem) {
    Alert.alert(
      'Delete item?',
      `${item.brand ?? item.category} will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('clothing_items')
              .delete()
              .eq('id', item.id);
            if (error) {
              Alert.alert('Delete failed', error.message);
              return;
            }
            // Best-effort cleanup; ignore failures so a stale storage object
            // never blocks the row deletion the user just confirmed.
            supabase.storage.from(STORAGE_BUCKET).remove([item.photo_path]).catch(() => {});
            invalidateSignedPhotoUrl(item.photo_path);
            setItems((cur) => cur.filter((i) => i.id !== item.id));
          },
        },
      ],
    );
  }

  function confirmReset() {
    Alert.alert(
      'Re-sort closet?',
      'Walk through every kept and archived item and re-pick keep or archive for each.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start', onPress: () => router.push('/closet/reset') },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.toolbarRow}>
        <Pressable
          style={styles.toolbarButton}
          onPress={() => router.push('/collections')}
          hitSlop={8}
        >
          <Ionicons name="albums-outline" size={22} color="#111" />
        </Pressable>
        <Pressable
          style={styles.toolbarButton}
          onPress={confirmReset}
          hitSlop={8}
        >
          <Ionicons name="refresh" size={22} color="#111" />
        </Pressable>
      </View>

      {selectedCollectionId ? null : (
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filter, filter === f && styles.filterActive]}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.collectionRow}>
        <Pressable
          style={styles.collectionDropdown}
          onPress={() => setDropdownOpen(true)}
        >
          <Ionicons name="albums-outline" size={16} color="#111" />
          <Text style={styles.collectionDropdownText} numberOfLines={1}>
            {selectedCollectionName ?? `All ${filter} items`}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#888" />
        </Pressable>
        {selectedCollectionId ? (
          <Pressable
            style={styles.collectionClear}
            onPress={() => setSelectedCollectionId(null)}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color="#888" />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        style={styles.outfitButton}
        onPress={() => router.push('/outfit')}
      >
        <Ionicons name="sparkles-outline" size={16} color="#111" />
        <Text style={styles.outfitButtonText}>Suggest an outfit</Text>
      </Pressable>

      <Modal
        visible={dropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setDropdownOpen(false)}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Filter by collection</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              <Pressable
                style={styles.modalOption}
                onPress={() => {
                  setSelectedCollectionId(null);
                  setDropdownOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    selectedCollectionId === null && styles.modalOptionActive,
                  ]}
                >
                  All items (use keep/archive/donate)
                </Text>
                {selectedCollectionId === null ? (
                  <Ionicons name="checkmark" size={20} color="#111" />
                ) : null}
              </Pressable>
              {collections.length === 0 ? (
                <Text style={styles.modalEmpty}>
                  No collections yet. Tap the albums icon above to create one.
                </Text>
              ) : (
                collections.map((c) => (
                  <Pressable
                    key={c.id}
                    style={styles.modalOption}
                    onPress={() => {
                      setSelectedCollectionId(c.id);
                      setDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        selectedCollectionId === c.id && styles.modalOptionActive,
                      ]}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                    {selectedCollectionId === c.id ? (
                      <Ionicons name="checkmark" size={20} color="#111" />
                    ) : null}
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>
          {selectedCollectionId
            ? `“${selectedCollectionName}” is empty. Open the collection to add items.`
            : `Nothing in “${filter}” yet. Tap Add to start your catalogue.`}
        </Text>
      ) : (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 6 }}
          renderItem={({ item }) => (
            <ItemTile
              item={item}
              onPress={() => router.push(`/item/${item.id}`)}
              onRemove={() => confirmDelete(item)}
            />
          )}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  toolbarButton: { padding: 6, borderRadius: 8 },
  filterRow: { flexDirection: 'row', padding: 12, gap: 8 },
  filter: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#eee',
  },
  filterActive: { backgroundColor: '#111' },
  filterText: { color: '#333', textTransform: 'capitalize' },
  filterTextActive: { color: '#fff' },
  outfitButton: {
    marginHorizontal: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f6f1ea',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  outfitButtonText: { fontWeight: '600' },
  empty: { textAlign: 'center', color: '#777', marginTop: 48, paddingHorizontal: 24 },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  collectionDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f3f3f3',
  },
  collectionDropdownText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  collectionClear: {
    padding: 6,
    borderRadius: 999,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  modalOptionText: { fontSize: 15, color: '#111', flex: 1 },
  modalOptionActive: { fontWeight: '700' },
  modalEmpty: {
    color: '#777',
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 18,
    textAlign: 'center',
  },
});
