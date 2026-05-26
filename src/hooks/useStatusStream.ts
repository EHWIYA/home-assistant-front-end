import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
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
  queryClient: QueryClient;
  onActiveChange: (active: boolean) => void;
}

/** GET /api/v1/status/stream — snapshot·status 이벤트로 캐시 갱신. 실패 시 onActiveChange(false). */
export function useStatusStream({
  queryKey,
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
      connect();
    };

    document.addEventListener("visibilitychange", onVisibility);
    connect();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      disconnect();
    };
  }, [queryClient, queryKey]);
}
