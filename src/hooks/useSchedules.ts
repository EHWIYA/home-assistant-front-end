import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchHolidays } from "@/api/meta";
import {
  createSchedule,
  deleteSchedule,
  fetchSchedulePreview,
  fetchScheduleRuns,
  fetchSchedules,
  patchSchedule,
} from "@/api/schedules";
import {
  applyStripPreset,
  createStripPreset,
  deleteStripPreset,
  fetchStripPresets,
  patchStripPreset,
} from "@/api/stripPresets";
import type {
  ScheduleCreateBody,
  SchedulePatchBody,
  StripChannelNumber,
  StripPresetCreateBody,
  StripPresetPatchBody,
} from "@/api/types";

export function schedulesQueryKey(channel?: StripChannelNumber) {
  return channel != null
    ? (["schedules", { channel }] as const)
    : (["schedules"] as const);
}

export function scheduleRunsQueryKey(id: string) {
  return ["schedules", id, "runs"] as const;
}

export function holidaysQueryKey(year: number) {
  return ["meta", "holidays", year] as const;
}

export function schedulePreviewQueryKey(
  from: string,
  to: string,
  channel?: StripChannelNumber,
) {
  return channel != null
    ? (["schedules", "preview", { from, to, channel }] as const)
    : (["schedules", "preview", { from, to }] as const);
}

export const STRIP_PRESETS_QUERY_KEY = ["strip", "presets"] as const;

export function useSchedules(channel?: StripChannelNumber) {
  return useQuery({
    queryKey: schedulesQueryKey(channel),
    queryFn: () => fetchSchedules(channel),
    staleTime: 30_000,
  });
}

export function useScheduleRuns(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: scheduleRunsQueryKey(id ?? ""),
    queryFn: () => fetchScheduleRuns(id!),
    enabled: Boolean(id) && enabled,
    staleTime: 60_000,
  });
}

export function useHolidays(year: number) {
  return useQuery({
    queryKey: holidaysQueryKey(year),
    queryFn: () => fetchHolidays(year),
    staleTime: 24 * 60 * 60_000,
  });
}

export function useSchedulePreview(
  from: string,
  to: string,
  channel?: StripChannelNumber,
  enabled = true,
) {
  return useQuery({
    queryKey: schedulePreviewQueryKey(from, to, channel),
    queryFn: () => fetchSchedulePreview(from, to, channel),
    enabled: enabled && Boolean(from && to),
    staleTime: 60_000,
  });
}

export function useStripPresets() {
  return useQuery({
    queryKey: STRIP_PRESETS_QUERY_KEY,
    queryFn: fetchStripPresets,
    staleTime: 60_000,
  });
}

export function useCreateSchedule(channel?: StripChannelNumber) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ScheduleCreateBody) => createSchedule(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["schedules"] });
      if (channel != null) {
        void queryClient.invalidateQueries({
          queryKey: schedulesQueryKey(channel),
        });
      }
    },
  });
}

export function usePatchSchedule(channel?: StripChannelNumber) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SchedulePatchBody }) =>
      patchSchedule(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["schedules"] });
      if (channel != null) {
        void queryClient.invalidateQueries({
          queryKey: schedulesQueryKey(channel),
        });
      }
    },
  });
}

export function useDeleteSchedule(channel?: StripChannelNumber) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["schedules"] });
      if (channel != null) {
        void queryClient.invalidateQueries({
          queryKey: schedulesQueryKey(channel),
        });
      }
    },
  });
}

export function useCreateStripPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: StripPresetCreateBody) => createStripPreset(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STRIP_PRESETS_QUERY_KEY });
    },
  });
}

export function usePatchStripPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      body,
    }: {
      name: string;
      body: StripPresetPatchBody;
    }) => patchStripPreset(name, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STRIP_PRESETS_QUERY_KEY });
    },
  });
}

export function useDeleteStripPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteStripPreset(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STRIP_PRESETS_QUERY_KEY });
    },
  });
}

export function useApplyStripPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => applyStripPreset(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["strip", "state"] });
    },
  });
}
