import type { IndoorClimate, WeatherOutdoor } from "@/api/types";

/** 홈 요약용 실내·외기 한 줄 */
export function formatClimateLine(
  indoor: IndoorClimate | null,
  weatherOutdoor: WeatherOutdoor | null,
): string {
  const parts: string[] = [];
  if (indoor) {
    parts.push(`실내 ${indoor.temperature}°C · ${indoor.humidity}%`);
  }
  if (weatherOutdoor) {
    parts.push(
      `외기 ${weatherOutdoor.temperature}°C · ${weatherOutdoor.humidity}%`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : "환경 센서 미연동";
}
