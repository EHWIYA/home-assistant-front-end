import type { IndoorClimate, WeatherOutdoor } from "@/api/types";

export function formatClimateValue(value: number): string {
  return value.toFixed(1);
}

export function formatTemperatureHumidity(
  temperature: number,
  humidity: number,
): string {
  return `${formatClimateValue(temperature)}°C · 습도 ${formatClimateValue(humidity)}%`;
}

/** 홈 요약용 실내·외기 한 줄 */
export function formatClimateLine(
  indoor: IndoorClimate | null,
  weatherOutdoor: WeatherOutdoor | null,
): string {
  const parts: string[] = [];
  if (indoor) {
    parts.push(
      `실내 ${formatTemperatureHumidity(indoor.temperature, indoor.humidity)}`,
    );
  }
  if (weatherOutdoor) {
    parts.push(`외기 ${formatTemperatureHumidity(weatherOutdoor.temperature, weatherOutdoor.humidity)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "환경 센서 미연동";
}
