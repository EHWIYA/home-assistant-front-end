import type { AcThresholdRule } from "@/api/types";

/** GET /ac/thresholds v3.0 — API·mock 공통 fallback (HA 정본 요약) */
export const AC_THRESHOLD_HOME_AUTO_ON_FALLBACK =
  "26°C 이상 15분 또는 (24°C 이상·습도 70% 이상 10분)";
export const AC_THRESHOLD_HOME_AUTO_OFF_FALLBACK =
  "24°C 미만·습도 55% 미만(각 10분 유지, 재가동 15분·26°C)";

/** 외출 — HA 정본 (API away가 home_auto와 같을 때도 사용) */
export const AC_THRESHOLD_AWAY_ON_FALLBACK =
  "27°C 이상 또는 습도 60% 이상 10분(실내 26°C 이상)";
export const AC_THRESHOLD_AWAY_OFF_FALLBACK =
  "27°C 미만 이고 습도 60% 미만";

/** away.on/off가 home_auto와 동일하면 백엔드 미수정 응답으로 간주 */
export function resolveAwayThresholdRule(
  away: AcThresholdRule | undefined,
  home: AcThresholdRule | undefined,
): AcThresholdRule | undefined {
  if (!away) return undefined;
  if (
    home &&
    away.on === home.on &&
    away.off === home.off
  ) {
    return {
      on: AC_THRESHOLD_AWAY_ON_FALLBACK,
      off: AC_THRESHOLD_AWAY_OFF_FALLBACK,
      notes: away.notes,
    };
  }
  return away;
}
