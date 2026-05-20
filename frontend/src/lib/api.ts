import { supabase } from './supabase';
import type { ScanResult } from '@/types';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Hard cap on a single scan attempt. The backend already retries transient
// 503/429 with its own backoff; this just prevents the app from hanging
// when the host is unreachable (firewall, dropped Wi-Fi, sleeping laptop).
const SCAN_TIMEOUT_MS = 20_000;

export async function scanPhoto(uri: string, signal?: AbortSignal): Promise<ScanResult> {
  const form = new FormData();
  // React Native FormData accepts this shape for file uploads.
  form.append('image', {
    uri,
    name: 'item.jpg',
    type: 'image/jpeg',
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
      // Drain the body so the socket isn't left open, but don't surface the
      // raw detail — it's a server stack trace 99% of the time.
      await res.text().catch(() => {});
      throw new Error(scanMessageForStatus(res.status));
    }
    return (await res.json()) as ScanResult;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error("Scan timed out. Try again.");
    }
    if (err instanceof TypeError) {
      // fetch throws TypeError on network failures (DNS, offline, CORS).
      throw new Error("Can't reach the scanner.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Map HTTP status to a short, friendly message. One line, no codes, no stack.
function scanMessageForStatus(status: number): string {
  if (status === 401 || status === 403) return 'Please sign in again.';
  if (status === 413) return 'That photo is too big.';
  if (status === 429) return 'Scanner is busy — try again.';
  if (status === 408 || status === 504) return 'Scan timed out. Try again.';
  if (status === 503) return 'Scanner is offline — try again soon.';
  if (status >= 500) return 'Scanner had a hiccup.';
  return 'Auto-tag unavailable.';
}
