import { supabase } from './lib/supabase';

export const API_BASE =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:8000";

async function authHeaders(extra?: HeadersInit): Promise<Record<string, string>> {
  const base: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra as Record<string, string> | undefined),
  };
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    base['Authorization'] = `Bearer ${session.access_token}`;
  }
  return base;
}

export async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders(init?.headers);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: HTTP ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function postJson<T, B>(
  path: string,
  body: B,
  init?: RequestInit
): Promise<T> {
  const headers = await authHeaders(init?.headers);
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: init?.signal,
  });
  if (!res.ok) {
    throw new Error(`POST ${path} failed: HTTP ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
