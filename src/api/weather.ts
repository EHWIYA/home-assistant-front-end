import { apiRequest } from "./http";
import mockWeatherLocal from "./mock/weather-local.json";
import type { WeatherLocalResponse } from "./types";
import { formatClimateValue } from "@/utils/climate";

export async function fetchLocalWeather(): Promise<WeatherLocalResponse> {
  return apiRequest<WeatherLocalResponse>("/api/v1/weather/local");
}

export function getMockLocalWeather(): WeatherLocalResponse {
  return { ...(mockWeatherLocal as WeatherLocalResponse) };
}

export function formatLocalWeatherLine(weather: WeatherLocalResponse): string {
  const label = weather.location_short_label;
  const humidity =
    Number.isInteger(weather.humidity)
      ? String(weather.humidity)
      : formatClimateValue(weather.humidity);
  return `${label} ${formatClimateValue(weather.temperature)}°C · 습도 ${humidity}% · ${weather.condition}`;
}

export type { WeatherLocalResponse };
