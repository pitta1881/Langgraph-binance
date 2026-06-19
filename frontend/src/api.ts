import { supabase } from './lib/supabase';

// `||` (not `??`) so an empty-string env var also falls back to the default.
// The Dockerfile declares ARG VITE_API_URL="", so if the deploy doesn't override
// it we'd otherwise inline `""` and end up hitting `/heatmap` without the prefix.
export const API_BASE =
  (import.meta.env["VITE_API_URL"] as string | undefined) || "/api";

async function authHeaders(extra?: HeadersInit): Promise<Record<string, string>> {
  const base: Record<string, string> = {
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
  headers['Content-Type'] = 'application/json';
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

export async function deleteJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders(init?.headers);
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers,
    signal: init?.signal,
  });
  if (!res.ok) {
    throw new Error(`DELETE ${path} failed: HTTP ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
