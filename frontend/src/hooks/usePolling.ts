import { useEffect, useState } from "react";
import { getJson } from "../api";
import type { FetchState } from "./useFetch";

export function usePolling<T>(path: string, intervalMs: number): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchOnce = () => {
      const controller = new AbortController();

      getJson<T>(path, { signal: controller.signal })
        .then((data) => {
          if (!cancelled) {
            setState({ loading: false, data, error: null });
          }
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          if (err instanceof Error && err.name === "AbortError") return;
          setState({
            loading: false,
            data: null,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        });

      return controller;
    };

    const first = fetchOnce();
    const timer = setInterval(() => fetchOnce(), intervalMs);

    return () => {
      cancelled = true;
      first.abort();
      clearInterval(timer);
    };
  }, [path, intervalMs]);

  return state;
}
