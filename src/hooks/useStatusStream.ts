import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { fetchAcState } from "@/api/client";
import { getStatusStreamUrl, shouldUseMock } from "@/api/http";
import type { StatusResponse } from "@/api/types";

function applyStatusEvent(
  queryClient: QueryClient,
  queryKey: QueryKey,
  raw: string,
): void {
  try {
    const parsed = JSON.parse(raw) as StatusResponse;
    queryClient.setQueryData(queryKey, parsed);
  } catch {
    // malformed SSE payload — ignore
  }
}

interface UseStatusStreamOptions {
  queryKey: QueryKey;
  acStateQueryKey?: QueryKey;
  queryClient: QueryClient;
  onActiveChange: (active: boolean) => void;
}

const AC_STATE_REFETCH_DEBOUNCE_MS = 150;

/** GET /api/v1/status/stream — snapshot·status 이벤트로 캐시 갱신. 실패 시 onActiveChange(false). */
export function useStatusStream({
  queryKey,
  acStateQueryKey,
  queryClient,
  onActiveChange,
}: UseStatusStreamOptions): void {
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;

  useEffect(() => {
    if (shouldUseMock()) return;

    const streamUrl = getStatusStreamUrl();
    if (!streamUrl) return;

    let es: EventSource | null = null;
    let disposed = false;
    let acStateRefetchTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleAcStateRefetch = () => {
      if (!acStateQueryKey) return;
      if (acStateRefetchTimer) clearTimeout(acStateRefetchTimer);
      acStateRefetchTimer = setTimeout(() => {
        acStateRefetchTimer = null;
        void queryClient.fetchQuery({
          queryKey: acStateQueryKey,
          queryFn: fetchAcState,
          staleTime: 0,
        });
      }, AC_STATE_REFETCH_DEBOUNCE_MS);
    };

    const clearAcStateRefetchTimer = () => {
      if (acStateRefetchTimer) {
        clearTimeout(acStateRefetchTimer);
        acStateRefetchTimer = null;
      }
    };

    const setActive = (active: boolean) => {
      onActiveChangeRef.current(active);
    };

    const disconnect = () => {
      es?.close();
      es = null;
      setActive(false);
    };

    const connect = () => {
      if (disposed || document.visibilityState === "hidden") return;

      disconnect();
      es = new EventSource(streamUrl);

      const onPayload = (ev: MessageEvent<string>) => {
        applyStatusEvent(queryClient, queryKey, ev.data);
        scheduleAcStateRefetch();
      };

      es.addEventListener("snapshot", onPayload);
      es.addEventListener("status", onPayload);

      es.onopen = () => {
        if (!disposed) setActive(true);
      };

      es.onerror = () => {
        disconnect();
      };
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        disconnect();
        return;
      }
      void queryClient.invalidateQueries({ queryKey });
      if (acStateQueryKey) {
        void queryClient.fetchQuery({
          queryKey: acStateQueryKey,
          queryFn: fetchAcState,
          staleTime: 0,
        });
      }
      connect();
    };

    document.addEventListener("visibilitychange", onVisibility);
    connect();

    return () => {
      disposed = true;
      clearAcStateRefetchTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      disconnect();
    };
  }, [acStateQueryKey, queryClient, queryKey]);
}
