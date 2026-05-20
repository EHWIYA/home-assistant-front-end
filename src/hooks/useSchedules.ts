import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSchedule,
  deleteSchedule,
  fetchScheduleRuns,
  fetchSchedules,
  patchSchedule,
} from "@/api/schedules";
import type { ScheduleCreateBody, SchedulePatchBody } from "@/api/types";

export const SCHEDULES_QUERY_KEY = ["schedules"] as const;

export function scheduleRunsQueryKey(id: string) {
  return ["schedules", id, "runs"] as const;
}

export function useSchedules() {
  return useQuery({
    queryKey: SCHEDULES_QUERY_KEY,
    queryFn: fetchSchedules,
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

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ScheduleCreateBody) => createSchedule(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY });
    },
  });
}

export function usePatchSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SchedulePatchBody }) =>
      patchSchedule(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY });
    },
  });
}
