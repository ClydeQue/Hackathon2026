import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY. ' +
      'Copy .env.example to frontend/.env and fill in your Supabase credentials.',
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // SecureStore on iOS has a ~2KB limit; Supabase session blobs exceed it
    // (legacy anon JWT alone is ~250 bytes, but refresh+access combined push
    // past 2 KB). AsyncStorage is the pattern Supabase officially recommends
    // for React Native.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const STORAGE_BUCKET = 'garments';
export const AVATAR_BUCKET = 'avatars';

export function avatarPublicUrl(path: string) {
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

// =====================================================================
// Signed URL cache
//
// `createSignedUrl` is cheap but adds round-trip latency on every render
// and hammers the storage API when scrolling a 100-item closet. We cache
// the URL by `photo_path` with its expiry, re-minting only when within
// REFRESH_WINDOW_MS of expiring. Cache is persisted to AsyncStorage so
// cold starts also benefit, and cleared on sign-out so we never serve a
// previous user's URLs.
// =====================================================================
const SIGNED_URL_TTL = 3600; // seconds; matches createSignedUrl default
const REFRESH_WINDOW_MS = 5 * 60 * 1000;
const CACHE_STORAGE_KEY = 'signedUrlCache:v1';

type CacheEntry = { url: string; expiresAt: number };
const memCache = new Map<string, CacheEntry>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

async function hydrate() {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
          const now = Date.now();
          for (const [path, entry] of Object.entries(parsed)) {
            if (entry.expiresAt - now > REFRESH_WINDOW_MS) {
              memCache.set(path, entry);
            }
          }
        }
      } catch {
        // Corrupt cache — start fresh.
      }
      hydrated = true;
    })();
  }
  await hydratePromise;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const snapshot: Record<string, CacheEntry> = {};
    for (const [k, v] of memCache) snapshot[k] = v;
    AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(snapshot)).catch(() => {});
  }, 250);
}

function clearSignedUrlCache() {
  memCache.clear();
  AsyncStorage.removeItem(CACHE_STORAGE_KEY).catch(() => {});
}

// Drop cached URLs when the auth session changes — a different user
// shouldn't see URLs minted under another account's session, and a
// signed-out device shouldn't keep accessible URLs sitting in storage.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
    clearSignedUrlCache();
  }
});

export async function signedPhotoUrl(path: string, expiresIn = SIGNED_URL_TTL) {
  await hydrate();
  const now = Date.now();
  const cached = memCache.get(path);
  if (cached && cached.expiresAt - now > REFRESH_WINDOW_MS) {
    return cached.url;
  }
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  memCache.set(path, { url: data.signedUrl, expiresAt: now + expiresIn * 1000 });
  schedulePersist();
  return data.signedUrl;
}

export function invalidateSignedPhotoUrl(path: string) {
  memCache.delete(path);
  schedulePersist();
}
