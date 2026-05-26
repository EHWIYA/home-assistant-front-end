import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStripState, setStripChannel } from "@/api/strip";
import type { StripChannelNumber, StripStateResponse } from "@/api/types";
import {
  POLLING_STALE_TIME_MS,
  usePollingIntervalMs,
} from "@/hooks/usePollingInterval";

export const STRIP_STATE_QUERY_KEY = ["strip", "state"] as const;

export function useStripState() {
  const refetchInterval = usePollingIntervalMs();

  return useQuery({
    queryKey: STRIP_STATE_QUERY_KEY,
    queryFn: fetchStripState,
    refetchInterval,
    refetchIntervalInBackground: true,
    staleTime: POLLING_STALE_TIME_MS,
  });
}

interface ChannelToggleVars {
  channel: StripChannelNumber;
  on: boolean;
}

export function useStripChannelToggle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ channel, on }: ChannelToggleVars) =>
      setStripChannel(channel, { on }),
    onSuccess: (data) => {
      queryClient.setQueryData<StripStateResponse>(
        STRIP_STATE_QUERY_KEY,
        data,
      );
    },
  });
}
