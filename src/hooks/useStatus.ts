import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchStatus, setAc, setPc, setPlug } from "@/api/client";
import type { OnOffAction, PlugSwitch } from "@/api/types";
import {
  POLLING_STALE_TIME_MS,
  usePollingIntervalMs,
} from "@/hooks/usePollingInterval";
import { useStatusStream } from "@/hooks/useStatusStream";

export const STATUS_QUERY_KEY = ["status"] as const;

export function useStatus() {
  const queryClient = useQueryClient();
  const refetchInterval = usePollingIntervalMs();
  const [sseActive, setSseActive] = useState(false);

  useStatusStream({
    queryKey: STATUS_QUERY_KEY,
    queryClient,
    onActiveChange: setSseActive,
  });

  return useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: fetchStatus,
    refetchInterval: sseActive ? false : refetchInterval,
    refetchIntervalInBackground: !sseActive,
    staleTime: POLLING_STALE_TIME_MS,
  });
}

export function usePlugToggle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (action: PlugSwitch) => setPlug({ action }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
    },
  });
}

export function useAcControl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (action: PlugSwitch) => setAc({ action }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
    },
  });
}

export function usePcToggle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (action: OnOffAction) => setPc({ action }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
    },
  });
}
