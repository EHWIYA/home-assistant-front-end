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

export interface AcPowerOffHints {
  acAutoState?: AcAutoState | null;
  /** status.plug 전력 기반 추정 가동 — stale power=off 보정 */
  plugEstimatedRunning?: boolean;
  /** /status ac_mode — power 미수신 시 꺼짐 오판 방지 */
  statusMode?: AcMode | null;
}

/** /ac/state power·status 신호 종합. power 미수신 시 ac_auto_state만으로 꺼짐 판정하지 않음 */
export function isAcPowerOff(
  power: AcStateResponse["power"] | undefined,
  hints: AcPowerOffHints = {},
): boolean {
  const { acAutoState, plugEstimatedRunning, statusMode } = hints;

  if (power === "off") {
    if (plugEstimatedRunning) return false;
    if (acAutoState?.state === "on") return false;
    return true;
  }
  if (power === "on") return false;

  if (plugEstimatedRunning) return false;
  if (acAutoState?.state === "on") return false;
  if (statusMode != null && statusMode !== "off") return false;
  if (acAutoState?.state === "off") return true;
  return false;
}

export function getAcOffStatusLabel(
  lastRunMode: AcLastRunMode | null | undefined,
): string {
  if (lastRunMode === "dry") return "꺼짐 · 마지막 제습";
  if (lastRunMode === "cool") return "꺼짐 · 마지막 냉방";
  return "꺼짐";
}

export interface AcUiActionModeInput {
  mode: AcMode;
  operatingMode?: AcOperatingMode | null;
  lastRunMode?: AcLastRunMode | null;
  power?: AcStateResponse["power"];
  acAutoState?: AcAutoState | null;
  plugEstimatedRunning?: boolean;
}

/**
 * ② 동작 타일 하이라이트.
 * 자동/외출 + mode=auto 가동 중이면 last_run_mode(냉방/제습)와 문구를 맞춤.
 */
export function resolveAcUiActionMode({
  mode,
  operatingMode,
  lastRunMode,
  power,
  acAutoState,
  plugEstimatedRunning,
}: AcUiActionModeInput): AcMode {
  if (operatingMode === "auto" || operatingMode === "away") {
    if (mode === "cool" || mode === "dry") {
      return mode;
    }
    if (
      mode === "auto" &&
      lastRunMode &&
      !isAcPowerOff(power, {
        acAutoState,
        plugEstimatedRunning,
        statusMode: mode,
      })
    ) {
      return lastRunMode;
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
  plugEstimatedRunning?: boolean;
}

function acPowerOffHints(input: AcModeDisplayInput): AcPowerOffHints {
  return {
    acAutoState: input.acAutoState,
    plugEstimatedRunning: input.plugEstimatedRunning,
    statusMode: input.mode,
  };
}

export function getAcModeDisplayText({
  mode,
  power,
  lastRunMode,
  operatingMode,
  acAutoState,
  plugEstimatedRunning,
}: AcModeDisplayInput): string {
  if (isAcPowerOff(power, acPowerOffHints({ mode, acAutoState, plugEstimatedRunning }))) {
    return getAcOffStatusLabel(lastRunMode);
  }

  if (operatingMode === "away") {
    return "외출";
  }

  if (operatingMode === "auto") {
    if (mode === "cool") {
      return "냉방";
    }
    if (power === "on" && lastRunMode) {
      return `자동 (${getAcLastRunModeLabel(lastRunMode)})`;
    }
    return AC_AI_ACTION_LABEL;
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
  plugEstimatedRunning?: boolean;
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
  plugEstimatedRunning,
  isRunning,
  isLowPowerRunning,
}: AcPrimaryStatusInput): string {
  if (isAcPowerOff(power, acPowerOffHints({ mode, acAutoState, plugEstimatedRunning }))) {
    return getAcOffStatusLabel(lastRunMode);
  }

  if (isLowPowerRunning) {
    return "저전력 가동";
  }

  if (isRunning && power === "on") {
    if (operatingMode === "away") {
      return "외출";
    }
    if (operatingMode === "auto") {
      if (lastRunMode === "dry") return "자동 · 제습";
      if (lastRunMode === "cool") return "자동 · 냉방";
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
    plugEstimatedRunning,
  });
}
