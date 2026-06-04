import type {
  AcAutoState,
  AcLastRunMode,
  AcMode,
  AcOperatingMode,
  AcStateResponse,
} from "@/api/types";
import { AC_AI_ACTION_LABEL } from "@/utils/acActionOptions";

export function getAcLastRunModeLabel(
  lastRunMode: AcLastRunMode | null | undefined,
): string {
  if (lastRunMode === "cool") return "냉방";
  if (lastRunMode === "dry") return "제습";
  return "—";
}

/** /ac/state power=off 또는 ac_auto_state.state=off */
export function isAcPowerOff(
  power: AcStateResponse["power"] | undefined,
  acAutoState?: AcAutoState | null,
): boolean {
  if (power === "off") return true;
  if (power === "on") return false;
  return acAutoState?.state === "off";
}

export function getAcOffStatusLabel(
  lastRunMode: AcLastRunMode | null | undefined,
): string {
  if (lastRunMode === "dry") return "꺼짐 · 마지막 제습";
  if (lastRunMode === "cool") return "꺼짐 · 마지막 냉방";
  return "꺼짐";
}

/**
 * 자동/외출 시 mode=dry 등 잔존 → ②는 인공지능(auto) 선택.
 * 수동이거나 냉방·제습 명시 시 해당 mode.
 */
export function resolveAcUiActionMode(
  mode: AcMode,
  operatingMode: AcOperatingMode | null | undefined,
): AcMode {
  if (operatingMode === "auto" || operatingMode === "away") {
    if (mode === "cool" || mode === "dry") {
      return mode;
    }
    return "auto";
  }
  return mode;
}

export interface AcModeDisplayInput {
  mode: AcMode;
  power?: AcStateResponse["power"];
  lastRunMode?: AcLastRunMode | null;
  operatingMode?: AcOperatingMode | null;
  acAutoState?: AcAutoState | null;
}

export function getAcModeDisplayText({
  mode,
  power,
  lastRunMode,
  operatingMode,
  acAutoState,
}: AcModeDisplayInput): string {
  if (isAcPowerOff(power, acAutoState)) {
    return getAcOffStatusLabel(lastRunMode);
  }

  if (operatingMode === "auto" || operatingMode === "away") {
    if (mode === "cool") {
      return operatingMode === "away" ? "외출 · 냉방" : "냉방";
    }
    if (power === "on" && lastRunMode) {
      const prefix = operatingMode === "away" ? "외출" : "자동";
      return `${prefix} (${getAcLastRunModeLabel(lastRunMode)})`;
    }
    return operatingMode === "away" ? "외출" : AC_AI_ACTION_LABEL;
  }

  if (mode === "off") return "끄기";
  if (mode === "cool") return "냉방";
  if (mode === "dry") return power === "on" ? "제습" : "끄기";
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

export interface AcPrimaryStatusInput {
  mode: AcMode;
  power?: AcStateResponse["power"];
  lastRunMode?: AcLastRunMode | null;
  operatingMode?: AcOperatingMode | null;
  acAutoState?: AcAutoState | null;
  isRunning: boolean;
  isLowPowerRunning: boolean;
}

/** 상태 카드·홈 요약용 큰 라벨 — mode=dry 단독으로 「제습 중」 금지 */
export function getAcPrimaryStatusLabel({
  mode,
  power,
  lastRunMode,
  operatingMode,
  acAutoState,
  isRunning,
  isLowPowerRunning,
}: AcPrimaryStatusInput): string {
  if (isAcPowerOff(power, acAutoState)) {
    return getAcOffStatusLabel(lastRunMode);
  }

  if (isLowPowerRunning) {
    return "저전력 가동";
  }

  if (isRunning && power === "on") {
    if (operatingMode === "auto" || operatingMode === "away") {
      const prefix = operatingMode === "away" ? "외출" : "자동";
      if (lastRunMode === "dry") return `${prefix} · 제습`;
      if (lastRunMode === "cool") return `${prefix} · 냉방`;
      if (mode === "cool") return "냉방 중";
      return "가동 중";
    }
    if (mode === "cool") return "냉방 중";
    if (mode === "dry") return "제습 중";
    if (mode === "auto" && lastRunMode === "dry") return "자동 · 제습";
    if (mode === "auto" && lastRunMode === "cool") return "자동 · 냉방";
    return "가동 중";
  }

  if (mode === "off") return "꺼짐";

  return getAcModeDisplayText({
    mode,
    power,
    lastRunMode,
    operatingMode,
    acAutoState,
  });
}
