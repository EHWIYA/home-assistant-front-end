import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchAcState, fetchStatus, setAc, setPc, setPlug } from "@/api/client";
import type { AcMode, OnOffAction, PlugSwitch } from "@/api/types";
import {
  POLLING_STALE_TIME_MS,
  usePollingIntervalMs,
} from "@/hooks/usePollingInterval";
import { useStatusStream } from "@/hooks/useStatusStream";

export const STATUS_QUERY_KEY = ["status"] as const;
export const AC_STATE_QUERY_KEY = ["ac-state"] as const;

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
    mutationFn: (mode: AcMode) => setAc({ mode }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: AC_STATE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
      await queryClient.refetchQueries({
        queryKey: AC_STATE_QUERY_KEY,
        type: "active",
      });
    },
  });
}

export function useAcState() {
  return useQuery({
    queryKey: AC_STATE_QUERY_KEY,
    queryFn: fetchAcState,
    staleTime: 0,
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
