import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/api/health";

export const HEALTH_QUERY_KEY = ["health"] as const;

export function useHealth(enabled = true) {
  return useQuery({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: fetchHealth,
    enabled,
    staleTime: 60_000,
    retry: 0,
  });
}
