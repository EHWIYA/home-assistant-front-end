import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchAcState,
  fetchAcThresholds,
  fetchStatus,
  setAc,
  setPc,
  setPlug,
} from "@/api/client";
import type {
  AcActionRequest,
  AcActionResponse,
  AcOperatingMode,
  AcStateResponse,
  OnOffAction,
  StatusResponse,
  PlugSwitch,
} from "@/api/types";
import {
  operatingModeToFlags,
} from "@/utils/acOperatingMode";
import {
  POLLING_STALE_TIME_MS,
  usePollingIntervalMs,
} from "@/hooks/usePollingInterval";
import { useStatusStream } from "@/hooks/useStatusStream";

export const STATUS_QUERY_KEY = ["status"] as const;
export const AC_STATE_QUERY_KEY = ["ac-state"] as const;
export const AC_THRESHOLDS_QUERY_KEY = ["ac-thresholds"] as const;

export type AcControlParams = AcActionRequest;

function getAcControlErrorMessage(
  response: AcActionResponse,
  requested: AcControlParams,
): string | null {
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
  if (response.applied_mode && response.applied_mode !== requested.mode) {
    return `요청 모드(${requested.mode})와 적용 모드(${response.applied_mode})가 다릅니다.`;
  }
  if (
    typeof requested.auto_enabled === "boolean" &&
    typeof response.auto_enabled === "boolean" &&
    response.auto_enabled !== requested.auto_enabled
  ) {
    return "요청한 자동제어 상태와 적용 상태가 다릅니다.";
  }
  if (
    typeof requested.away_enabled === "boolean" &&
    typeof response.away_enabled === "boolean" &&
    response.away_enabled !== requested.away_enabled
  ) {
    return "요청한 외출모드 상태와 적용 상태가 다릅니다.";
  }
  if (
    requested.operating_mode &&
    response.operating_mode &&
    response.operating_mode !== requested.operating_mode
  ) {
    return "요청한 운전모드와 적용 상태가 다릅니다.";
  }
  return null;
}

function applyOperatingModePatch(
  operatingMode: AcOperatingMode,
): {
  auto_enabled: boolean;
  away_enabled: boolean;
  operating_mode: AcOperatingMode;
} {
  const flags = operatingModeToFlags(operatingMode);
  return {
    ...flags,
    operating_mode: operatingMode,
  };
}

function patchAcState(
  previous: AcStateResponse | undefined,
  params: AcControlParams,
): AcStateResponse | undefined {
  if (!previous) {
    return undefined;
  }
  const next: AcStateResponse = { ...previous, mode: params.mode };
  if (params.operating_mode) {
    Object.assign(next, applyOperatingModePatch(params.operating_mode));
  } else {
    if (typeof params.auto_enabled === "boolean") {
      next.auto_enabled = params.auto_enabled;
    }
    if (typeof params.away_enabled === "boolean") {
      next.away_enabled = params.away_enabled;
    }
  }
  if (params.mode === "off") {
    next.power = "off";
  } else {
    next.power = "on";
    if (params.mode === "cool" || params.mode === "dry") {
      next.last_run_mode = params.mode;
    }
  }
  return next;
}

function patchStatusAc(
  previous: StatusResponse | undefined,
  params: AcControlParams,
): StatusResponse | undefined {
  if (!previous) {
    return undefined;
  }
  const next: StatusResponse = {
    ...previous,
    ac_mode: params.mode,
  };
  if (params.operating_mode) {
    const flags = applyOperatingModePatch(params.operating_mode);
    next.ac_operating_mode = flags.operating_mode;
    next.ac_auto_enabled = flags.auto_enabled;
    next.ac_away_enabled = flags.away_enabled;
    if (params.operating_mode === "auto") {
      next.plug = { ...previous.plug, switch: "on" };
    } else if (params.operating_mode === "manual") {
      next.plug = { ...previous.plug, switch: "off" };
    }
  } else {
    if (typeof params.auto_enabled === "boolean") {
      next.ac_auto_enabled = params.auto_enabled;
      next.plug = {
        ...previous.plug,
        switch: params.auto_enabled ? "on" : "off",
      };
    }
    if (typeof params.away_enabled === "boolean") {
      next.ac_away_enabled = params.away_enabled;
    }
  }
  if (params.mode === "cool" || params.mode === "dry") {
    next.ac_last_run_mode = params.mode;
  }
  if (params.mode !== "off" && previous.ac_auto_state) {
    next.ac_auto_state = {
      ...previous.ac_auto_state,
      state: "on",
    };
  } else if (params.mode === "off" && previous.ac_auto_state) {
    next.ac_auto_state = {
      ...previous.ac_auto_state,
      state: "off",
    };
  }
  return next;
}

export function useStatus() {
  const queryClient = useQueryClient();
  const refetchInterval = usePollingIntervalMs();
  const [sseActive, setSseActive] = useState(false);

  useStatusStream({
    queryKey: STATUS_QUERY_KEY,
    acStateQueryKey: AC_STATE_QUERY_KEY,
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
    mutationFn: async (params: AcControlParams) => {
      const response = await setAc(params);
      const responseError = getAcControlErrorMessage(response, params);
      if (responseError) {
        throw new Error(responseError);
      }
      return response;
    },
    onMutate: async (params: AcControlParams) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: AC_STATE_QUERY_KEY }),
        queryClient.cancelQueries({ queryKey: STATUS_QUERY_KEY }),
      ]);
      const previousAcState = queryClient.getQueryData<AcStateResponse>(AC_STATE_QUERY_KEY);
      const previousStatus = queryClient.getQueryData<StatusResponse>(STATUS_QUERY_KEY);

      const nextAcState = patchAcState(previousAcState, params);
      if (nextAcState) {
        queryClient.setQueryData(AC_STATE_QUERY_KEY, nextAcState);
      }
      const nextStatus = patchStatusAc(previousStatus, params);
      if (nextStatus) {
        queryClient.setQueryData(STATUS_QUERY_KEY, nextStatus);
      }

      return { previousAcState, previousStatus };
    },
    onError: (_error, _params, context) => {
      if (context?.previousAcState) {
        queryClient.setQueryData(AC_STATE_QUERY_KEY, context.previousAcState);
      }
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

export function useAcThresholds() {
  return useQuery({
    queryKey: AC_THRESHOLDS_QUERY_KEY,
    queryFn: fetchAcThresholds,
    staleTime: 5 * 60 * 1000,
  });
}

/** @deprecated useAcControl + operating_mode 사용 권장 */
export function useAcAutoToggle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const acState = queryClient.getQueryData<AcStateResponse>(AC_STATE_QUERY_KEY);
      const status = queryClient.getQueryData<StatusResponse>(STATUS_QUERY_KEY);
      const mode = acState?.mode ?? status?.ac_mode ?? "off";
      const lastRunMode = acState?.last_run_mode ?? status?.ac_last_run_mode ?? null;
      const params: AcControlParams =
        enabled
          ? { mode: "auto", operating_mode: "auto" }
          : {
              mode:
                mode === "auto" || mode === "off" ? (lastRunMode ?? "cool") : mode,
              operating_mode: "manual",
            };
      const response = await setAc(params);
      const responseError = getAcControlErrorMessage(response, params);
      if (responseError) {
        throw new Error(responseError);
      }
      return response;
    },
    onMutate: async (enabled: boolean) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: AC_STATE_QUERY_KEY }),
        queryClient.cancelQueries({ queryKey: STATUS_QUERY_KEY }),
      ]);
      const acState = queryClient.getQueryData<AcStateResponse>(AC_STATE_QUERY_KEY);
      const status = queryClient.getQueryData<StatusResponse>(STATUS_QUERY_KEY);
      const mode = acState?.mode ?? status?.ac_mode ?? "off";
      const lastRunMode = acState?.last_run_mode ?? status?.ac_last_run_mode ?? null;
      const params: AcControlParams =
        enabled
          ? { mode: "auto", operating_mode: "auto" }
          : {
              mode:
                mode === "auto" || mode === "off" ? (lastRunMode ?? "cool") : mode,
              operating_mode: "manual",
            };
      const previousAcState = queryClient.getQueryData<AcStateResponse>(AC_STATE_QUERY_KEY);
      const previousStatus = queryClient.getQueryData<StatusResponse>(STATUS_QUERY_KEY);
      const nextAcState = patchAcState(previousAcState, params);
      if (nextAcState) {
        queryClient.setQueryData(AC_STATE_QUERY_KEY, nextAcState);
      }
      const nextStatus = patchStatusAc(previousStatus, params);
      if (nextStatus) {
        queryClient.setQueryData(STATUS_QUERY_KEY, nextStatus);
      }
      return { previousAcState, previousStatus };
    },
    onError: (_error, _enabled, context) => {
      if (context?.previousAcState) {
        queryClient.setQueryData(AC_STATE_QUERY_KEY, context.previousAcState);
      }
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
