import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMoodCapabilities,
  fetchMoodMeta,
  fetchMoodState,
  postMoodBrightness,
  postMoodColor,
  postMoodColorHs,
  postMoodColorRgb,
  postMoodColorTemperature,
  postMoodPower,
} from "@/api/mood";
import type {
  MoodBrightnessRequest,
  MoodColorHsRequest,
  MoodColorName,
  MoodColorRgbRequest,
  MoodColorTemperatureMode,
} from "@/api/types";
import {
  POLLING_STALE_TIME_MS,
  usePollingIntervalMs,
} from "@/hooks/usePollingInterval";

export const MOOD_META_QUERY_KEY = ["mood", "meta"] as const;
export const MOOD_CAPABILITIES_QUERY_KEY = ["mood", "capabilities"] as const;
export const MOOD_STATE_QUERY_KEY = ["mood", "state"] as const;

export function useMoodMeta() {
  const refetchInterval = usePollingIntervalMs();

  return useQuery({
    queryKey: MOOD_META_QUERY_KEY,
    queryFn: fetchMoodMeta,
    refetchInterval,
    refetchIntervalInBackground: true,
    staleTime: POLLING_STALE_TIME_MS,
  });
}

export function useMoodCapabilities() {
  const refetchInterval = usePollingIntervalMs();

  return useQuery({
    queryKey: MOOD_CAPABILITIES_QUERY_KEY,
    queryFn: fetchMoodCapabilities,
    refetchInterval,
    refetchIntervalInBackground: true,
    staleTime: POLLING_STALE_TIME_MS,
  });
}

export function useMoodState(enabled: boolean) {
  const refetchInterval = usePollingIntervalMs();

  return useQuery({
    queryKey: MOOD_STATE_QUERY_KEY,
    queryFn: fetchMoodState,
    enabled,
    refetchInterval: enabled ? refetchInterval : false,
    refetchIntervalInBackground: enabled,
    staleTime: POLLING_STALE_TIME_MS,
  });
}

function useInvalidateMoodState() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: MOOD_STATE_QUERY_KEY });
  };
}

export function useMoodPower() {
  const invalidateState = useInvalidateMoodState();

  return useMutation({
    mutationFn: (on: boolean) => postMoodPower({ on }),
    onSuccess: () => invalidateState(),
  });
}

export function useMoodBrightness() {
  const invalidateState = useInvalidateMoodState();

  return useMutation({
    mutationFn: (body: MoodBrightnessRequest) => postMoodBrightness(body),
    onSuccess: () => invalidateState(),
  });
}

export function useMoodColor() {
  const invalidateState = useInvalidateMoodState();

  return useMutation({
    mutationFn: (name: MoodColorName) => postMoodColor({ name }),
    onSuccess: () => invalidateState(),
  });
}

export function useMoodColorHs() {
  const invalidateState = useInvalidateMoodState();

  return useMutation({
    mutationFn: (body: MoodColorHsRequest) => postMoodColorHs(body),
    onSuccess: () => invalidateState(),
  });
}

export function useMoodColorRgb() {
  const invalidateState = useInvalidateMoodState();

  return useMutation({
    mutationFn: (body: MoodColorRgbRequest) => postMoodColorRgb(body),
    onSuccess: () => invalidateState(),
  });
}

export function useMoodColorTemperature() {
  return useMutation({
    mutationFn: (mode: MoodColorTemperatureMode) =>
      postMoodColorTemperature({ mode }),
  });
}
