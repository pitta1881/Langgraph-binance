import { useEffect, useState } from "react";
import type { DependencyList } from "react";
import { getJson } from "../api";

export interface FetchState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export function useFetch<T>(
  path: string,
  deps: DependencyList = []
): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, data: null, error: null });

    getJson<T>(path, { signal: controller.signal })
      .then((data) => {
        setState({ loading: false, data, error: null });
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setState({
          loading: false,
          data: null,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });

    return () => {
      controller.abort();
    };
    // deps forwarded from caller; path change triggers re-fetch automatically
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  return state;
}
