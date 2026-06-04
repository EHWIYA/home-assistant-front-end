import type { AcLastRunMode, AcMode, AcStateResponse } from "@/api/types";

export function getAcLastRunModeLabel(lastRunMode: AcLastRunMode | null | undefined): string {
  if (lastRunMode === "cool") return "냉방";
  if (lastRunMode === "dry") return "제습";
  return "—";
}

export interface AcModeDisplayInput {
  mode: AcMode;
  power?: AcStateResponse["power"];
  lastRunMode?: AcLastRunMode | null;
}

/** 화면용 모드 문구 — mode=auto·power=on 이면 last_run_mode 반영 */
export function getAcModeDisplayText({
  mode,
  power,
  lastRunMode,
}: AcModeDisplayInput): string {
  if (mode === "off") {
    return "끄기";
  }
  if (mode === "cool") {
    return "냉방";
  }
  if (mode === "dry") {
    return "제습";
  }
  if (mode === "auto") {
    if (power === "on" && lastRunMode) {
      return `자동 (${getAcLastRunModeLabel(lastRunMode)})`;
    }
    return "자동";
  }
  return mode;
}

export function getAcAwayEnabledLabel(enabled: boolean | null | undefined): string {
  if (enabled === true) return "외출모드 켜짐";
  if (enabled === false) return "외출모드 꺼짐";
  return "외출 상태 알 수 없음";
}
