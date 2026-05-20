import { supabase } from './supabase';
import type { ScanResult } from '@/types';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

export type ScanPhotoInput = {
  uri: string;
  name?: string | null;
  type?: string | null;
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Hard cap on a single scan attempt. iPhone library photos can take a while to
// upload over LAN before Gemini even starts classifying, so keep this longer
// than the backend's transient retry window.
const SCAN_TIMEOUT_MS = 60_000;

export async function scanPhoto(photo: ScanPhotoInput, signal?: AbortSignal): Promise<ScanResult> {
  const form = new FormData();
  // React Native FormData accepts this shape for file uploads.
  form.append('image', {
    uri: photo.uri,
    name: photo.name ?? fileNameFromUri(photo.uri),
    type: photo.type ?? mediaTypeFromName(photo.name ?? photo.uri),
  } as unknown as Blob);

  const timer = new AbortController();
  const timeoutId = setTimeout(() => timer.abort(), SCAN_TIMEOUT_MS);
  // Forward an external abort (e.g. user cancelled / picked a new photo).
  if (signal) {
    if (signal.aborted) timer.abort();
    else signal.addEventListener('abort', () => timer.abort(), { once: true });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/scan`, {
      method: 'POST',
      headers: { ...(await authHeader()) },
      body: form,
      signal: timer.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      let detail = text;
      try {
        const parsed = JSON.parse(text);
        detail = parsed.detail ?? parsed.error ?? text;
      } catch {
        // not JSON; use raw text
      }
      throw new Error(`scan failed (${res.status}): ${detail}`);
    }
    return (await res.json()) as ScanResult;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Auto-tag timed out. Check your connection or try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function fileNameFromUri(uri: string): string {
  const cleanUri = uri.split('?')[0] ?? uri;
  const lastSegment = cleanUri.split('/').filter(Boolean).pop();
  return lastSegment ? decodeURIComponent(lastSegment) : 'item.jpg';
}

function mediaTypeFromName(nameOrUri: string): string {
  const lower = nameOrUri.split('?')[0]?.toLowerCase() ?? '';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}
