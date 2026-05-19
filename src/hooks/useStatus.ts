import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStatus, setAc, setPlug } from "@/api/client";
import type { PlugSwitch } from "@/api/types";

export const STATUS_QUERY_KEY = ["status"] as const;

export function useStatus() {
  return useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: fetchStatus,
    refetchInterval: 12_000,
    staleTime: 8_000,
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
