export const API_BASE =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:8000";

export async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
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
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });
  if (!res.ok) {
    throw new Error(`POST ${path} failed: HTTP ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
