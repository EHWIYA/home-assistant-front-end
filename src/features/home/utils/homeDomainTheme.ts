/** 홈 도메인 accent 색상 */
export const HOME_DOMAIN_THEME = {
  home: {
    accent: "#5b9fd4",
    accentSoft: "rgba(91, 159, 212, 0.14)",
    accentGlow: "rgba(91, 159, 212, 0.35)",
  },
  ac: {
    accent: "#5b9fd4",
    accentSoft: "rgba(91, 159, 212, 0.14)",
    accentGlow: "rgba(91, 159, 212, 0.35)",
  },
  pc: {
    accent: "#9c7bd8",
    accentSoft: "rgba(156, 123, 216, 0.14)",
    accentGlow: "rgba(156, 123, 216, 0.35)",
  },
  strip: {
    accent: "#e8b84a",
    accentSoft: "rgba(232, 184, 74, 0.14)",
    accentGlow: "rgba(232, 184, 74, 0.35)",
  },
  mood: {
    accent: "#c77dff",
    accentSoft: "rgba(199, 125, 255, 0.14)",
    accentGlow: "rgba(199, 125, 255, 0.35)",
  },
  settings: {
    accent: "#8b9eb0",
    accentSoft: "rgba(139, 158, 176, 0.14)",
    accentGlow: "rgba(139, 158, 176, 0.35)",
  },
} as const;

export type HomeDomainKey = keyof typeof HOME_DOMAIN_THEME;

/** 전력 bar 정규화 — PC·플러그 공통 기준 300W */
export const HOME_POWER_BAR_MAX_W = 300;

export function normalizePowerW(powerW: number | null, maxW = HOME_POWER_BAR_MAX_W): number {
  if (powerW == null || powerW <= 0) {
    return 0;
  }
  return Math.min(1, powerW / maxW);
}

/** 전력 레벨 시각화용 5칸 bar 높이 (히스토리 API 없을 때 현재값 기반) */
export function getPowerLevelHeights(
  powerW: number | null,
  maxW = HOME_POWER_BAR_MAX_W,
): number[] {
  const level = normalizePowerW(powerW, maxW);
  return [0.35, 0.5, 0.65, 0.8, 1].map((factor) =>
    Math.max(0.12, level * factor),
  );
}
