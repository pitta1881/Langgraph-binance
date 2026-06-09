import { DEFAULT_FETCH_TIMEOUT_MS } from '../constants.ts';

/**
 * fetch() with a hard AbortController timeout.
 *
 * Clears the timer in the finally block so the Node event loop is not held
 * open by a dangling setTimeout after the request completes.
 */
export async function fetchWithTimeout(
  url: URL | string,
  init: RequestInit | undefined,
  ms = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
