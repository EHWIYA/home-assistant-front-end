/** 기상청 condition(한글) → Cupertino 아이콘 카테고리 */
export type WeatherIconKind =
  | "clear"
  | "partly"
  | "cloud"
  | "rain"
  | "snow"
  | "fog"
  | "storm";

export function getKmaWeatherIconKind(condition: string): WeatherIconKind {
  if (condition.includes("뇌") || condition.includes("번개")) {
    return "storm";
  }
  if (condition.includes("눈")) {
    return "snow";
  }
  if (condition.includes("비") || condition.includes("소나기")) {
    return "rain";
  }
  if (condition.includes("안개")) {
    return "fog";
  }
  if (condition.includes("흐림")) {
    return "cloud";
  }
  if (condition.includes("구름")) {
    return "partly";
  }
  return "clear";
}

/** SKY·PTY 코드 보조 (condition 없을 때) */
export function getKmaWeatherIconKindFromCode(
  conditionCode: string | null | undefined,
): WeatherIconKind | null {
  if (!conditionCode) {
    return null;
  }
  switch (conditionCode) {
    case "1":
      return "clear";
    case "3":
      return "partly";
    case "4":
      return "cloud";
    case "2":
      return "rain";
    case "5":
    case "6":
      return "rain";
    case "7":
      return "snow";
    default:
      return null;
  }
}

export function resolveKmaWeatherIconKind(
  condition: string,
  conditionCode?: string | null,
): WeatherIconKind {
  const fromText = getKmaWeatherIconKind(condition);
  if (fromText !== "clear" || condition.includes("맑")) {
    return fromText;
  }
  return getKmaWeatherIconKindFromCode(conditionCode) ?? fromText;
}
