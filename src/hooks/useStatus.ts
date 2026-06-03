import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchAcState,
  fetchStatus,
  setAc,
  setAcAuto,
  setPc,
  setPlug,
} from "@/api/client";
import type {
  AcActionResponse,
  AcAutoToggleResponse,
  AcMode,
  AcStateResponse,
  OnOffAction,
  StatusResponse,
  PlugSwitch,
} from "@/api/types";
import {
  POLLING_STALE_TIME_MS,
  usePollingIntervalMs,
} from "@/hooks/usePollingInterval";
import { useStatusStream } from "@/hooks/useStatusStream";

export const STATUS_QUERY_KEY = ["status"] as const;
export const AC_STATE_QUERY_KEY = ["ac-state"] as const;

function getAcControlErrorMessage(response: AcActionResponse, requestedMode: AcMode): string | null {
  if (!response.ok) {
    return response.error?.trim() || "에어컨 제어에 실패했습니다.";
  }
  if (response.partial_failure) {
    return (
      response.error?.trim() ||
      "일부 명령만 적용되었습니다. 장치 상태 동기화 중이며 다시 시도해 주세요."
    );
  }
  if (response.error?.trim()) {
    return response.error.trim();
  }
  if (response.applied_mode && response.applied_mode !== requestedMode) {
    return `요청 모드(${requestedMode})와 적용 모드(${response.applied_mode})가 다릅니다.`;
  }
  return null;
}

function getAcAutoToggleErrorMessage(
  response: AcAutoToggleResponse,
  requestedEnabled: boolean,
): string | null {
  if (!response.ok) {
    return response.error?.trim() || "자동제어 토글에 실패했습니다.";
  }
  if (response.error?.trim()) {
    return response.error.trim();
  }
  if (
    typeof response.auto_enabled === "boolean" &&
    response.auto_enabled !== requestedEnabled
  ) {
    return "요청한 자동제어 상태와 적용 상태가 다릅니다.";
  }
  if (response.plug_switch) {
    const expectedPlug = requestedEnabled ? "on" : "off";
    if (response.plug_switch !== expectedPlug) {
      return "자동제어와 플러그 상태가 일치하지 않습니다.";
    }
  }
  return null;
}

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
    mutationFn: async (mode: AcMode) => {
      const response = await setAc({ mode });
      const responseError = getAcControlErrorMessage(response, mode);
      if (responseError) {
        throw new Error(responseError);
      }
      return response;
    },
    onMutate: async (mode: AcMode) => {
      await queryClient.cancelQueries({ queryKey: AC_STATE_QUERY_KEY });
      const previousAcState = queryClient.getQueryData<AcStateResponse>(AC_STATE_QUERY_KEY);

      if (previousAcState) {
        queryClient.setQueryData<AcStateResponse>(AC_STATE_QUERY_KEY, {
          ...previousAcState,
          mode,
        });
      }

      return { previousAcState };
    },
    onError: (_error, _mode, context) => {
      if (context?.previousAcState) {
        queryClient.setQueryData(AC_STATE_QUERY_KEY, context.previousAcState);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.fetchQuery({
          queryKey: AC_STATE_QUERY_KEY,
          queryFn: fetchAcState,
          staleTime: 0,
        }),
        queryClient.fetchQuery({
          queryKey: STATUS_QUERY_KEY,
          queryFn: fetchStatus,
          staleTime: 0,
        }),
      ]);
    },
  });
}

export function useAcState() {
  const refetchInterval = usePollingIntervalMs();

  return useQuery({
    queryKey: AC_STATE_QUERY_KEY,
    queryFn: fetchAcState,
    staleTime: 0,
    refetchInterval,
    refetchIntervalInBackground: false,
  });
}

export function useAcAutoToggle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await setAcAuto({ enabled });
      const responseError = getAcAutoToggleErrorMessage(response, enabled);
      if (responseError) {
        throw new Error(responseError);
      }
      return response;
    },
    onMutate: async (enabled: boolean) => {
      await queryClient.cancelQueries({ queryKey: STATUS_QUERY_KEY });
      const previousStatus = queryClient.getQueryData<StatusResponse>(STATUS_QUERY_KEY);

      if (previousStatus) {
        queryClient.setQueryData<StatusResponse>(STATUS_QUERY_KEY, {
          ...previousStatus,
          ac_auto_enabled: enabled,
          plug: {
            ...previousStatus.plug,
            switch: enabled ? "on" : "off",
          },
        });
      }

      return { previousStatus };
    },
    onError: (_error, _enabled, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(STATUS_QUERY_KEY, context.previousStatus);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.fetchQuery({
          queryKey: AC_STATE_QUERY_KEY,
          queryFn: fetchAcState,
          staleTime: 0,
        }),
        queryClient.fetchQuery({
          queryKey: STATUS_QUERY_KEY,
          queryFn: fetchStatus,
          staleTime: 0,
        }),
      ]);
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
