import type { WeatherLocalResponse } from "@/api/types";
import type { WeatherOutdoor } from "@/api/types";
import cloudSvg from "cupertino-icons-svg/svg/cloud_fill.svg?raw";
import cloudRainSvg from "cupertino-icons-svg/svg/cloud_rain_fill.svg?raw";
import cloudSnowSvg from "cupertino-icons-svg/svg/cloud_snow_fill.svg?raw";
import cloudSunSvg from "cupertino-icons-svg/svg/cloud_sun_fill.svg?raw";
import cloudBoltSvg from "cupertino-icons-svg/svg/cloud_bolt_fill.svg?raw";
import cloudFogSvg from "cupertino-icons-svg/svg/cloud_fog_fill.svg?raw";
import sunSvg from "cupertino-icons-svg/svg/sun_max_fill.svg?raw";
import { resolveKmaWeatherIconKind, type WeatherIconKind } from "@/utils/weatherCode";

const ICON_BY_KIND: Record<WeatherIconKind, string> = {
  clear: sunSvg,
  partly: cloudSunSvg,
  cloud: cloudSvg,
  rain: cloudRainSvg,
  snow: cloudSnowSvg,
  fog: cloudFogSvg,
  storm: cloudBoltSvg,
};

export function getLocalWeatherIconSvg(weather: WeatherLocalResponse): string {
  const kind = resolveKmaWeatherIconKind(
    weather.condition,
    weather.condition_code,
  );
  return ICON_BY_KIND[kind];
}

/** iot-api weather_outdoor — 에어컨 탭(실외기/외기)용 */
export function getOutdoorWeatherIconSvg(
  weather: WeatherOutdoor | null,
): string {
  if (!weather) {
    return cloudSvg;
  }
  if (weather.humidity >= 75 || weather.temperature <= 5) {
    return cloudSvg;
  }
  if (weather.humidity >= 55) {
    return cloudSunSvg;
  }
  return sunSvg;
}
