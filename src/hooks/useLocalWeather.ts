import { useQuery } from "@tanstack/react-query";
import {
  fetchLocalWeather,
  getMockLocalWeather,
} from "@/api/weather";
import { shouldUseMock } from "@/api/http";
import type { WeatherLocalResponse } from "@/api/types";
import {
  LOCAL_WEATHER_REFETCH_MS,
  LOCAL_WEATHER_STALE_MS,
} from "@/config/location";

async function queryLocalWeather(): Promise<WeatherLocalResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 120));
    return getMockLocalWeather();
  }
  return fetchLocalWeather();
}

export function useLocalWeather() {
  return useQuery({
    queryKey: ["localWeather"],
    queryFn: queryLocalWeather,
    staleTime: LOCAL_WEATHER_STALE_MS,
    refetchInterval: LOCAL_WEATHER_REFETCH_MS,
    retry: 1,
  });
}
