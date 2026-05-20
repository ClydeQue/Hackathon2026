import { supabase } from './supabase';
import type { ScanResult } from '@/types';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function scanPhoto(uri: string): Promise<ScanResult> {
  const form = new FormData();
  // React Native FormData accepts this shape for file uploads.
  form.append('image', {
    uri,
    name: 'item.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const res = await fetch(`${BACKEND_URL}/scan`, {
    method: 'POST',
    headers: { ...(await authHeader()) },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`scan failed (${res.status}): ${text}`);
  }
  return (await res.json()) as ScanResult;
}
