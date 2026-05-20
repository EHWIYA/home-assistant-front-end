import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStripState, setStripChannel } from "@/api/strip";
import type { StripChannelNumber, StripStateResponse } from "@/api/types";

export const STRIP_STATE_QUERY_KEY = ["strip", "state"] as const;

export function useStripState() {
  return useQuery({
    queryKey: STRIP_STATE_QUERY_KEY,
    queryFn: fetchStripState,
    refetchInterval: 12_000,
    staleTime: 8_000,
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
