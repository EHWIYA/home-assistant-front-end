import type {
  AcActionRequest,
  AcLastRunMode,
  AcMode,
  AcOperatingMode,
} from "@/api/types";

export function deriveAcOperatingMode(
  operatingMode: AcOperatingMode | null | undefined,
  autoEnabled: boolean | null | undefined,
  awayEnabled: boolean | null | undefined,
): AcOperatingMode | null {
  if (
    operatingMode === "manual" ||
    operatingMode === "auto" ||
    operatingMode === "away"
  ) {
    return operatingMode;
  }
  if (awayEnabled === true) return "away";
  if (autoEnabled === true) return "auto";
  if (autoEnabled === false && awayEnabled === false) return "manual";
  return null;
}

export function getAcOperatingModeLabel(
  operatingMode: AcOperatingMode | null | undefined,
): string {
  if (operatingMode === "manual") return "수동";
  if (operatingMode === "auto") return "자동";
  if (operatingMode === "away") return "외출";
  return "—";
}

export function operatingModeToFlags(operatingMode: AcOperatingMode): {
  auto_enabled: boolean;
  away_enabled: boolean;
} {
  switch (operatingMode) {
    case "manual":
      return { auto_enabled: false, away_enabled: false };
    case "auto":
      return { auto_enabled: true, away_enabled: false };
    case "away":
      return { auto_enabled: false, away_enabled: true };
  }
}

export function buildAcModeControlRequest(
  targetMode: AcMode,
  operatingMode: AcOperatingMode,
): AcActionRequest {
  if (operatingMode === "away" && targetMode === "off") {
    return { mode: "auto", operating_mode: "away" };
  }
  return { mode: targetMode, operating_mode: operatingMode };
}

/** ② 동작 탭 — 자동/외출에서 냉방·제습은 수동 전환 */
export function buildAcActionControlRequest(
  targetMode: AcMode,
  operatingMode: AcOperatingMode | null | undefined,
): AcActionRequest {
  const effective = operatingMode ?? "manual";

  if (targetMode === "auto") {
    if (effective === "auto") {
      return { mode: "auto", operating_mode: "auto" };
    }
    if (effective === "away") {
      return { mode: "auto", operating_mode: "away" };
    }
  }

  if (
    (targetMode === "cool" || targetMode === "dry") &&
    (effective === "auto" || effective === "away")
  ) {
    return { mode: targetMode, operating_mode: "manual" };
  }

  return buildAcModeControlRequest(targetMode, effective);
}

export function buildAcOperatingModeSwitchRequest(
  operatingMode: AcOperatingMode,
  currentMode: AcMode,
  lastRunMode: AcLastRunMode | null | undefined,
): AcActionRequest {
  if (operatingMode === "auto") {
    return { mode: "auto", operating_mode: "auto" };
  }
  if (operatingMode === "away") {
    return { mode: "auto", operating_mode: "away" };
  }
  const mode =
    currentMode === "auto" || currentMode === "off"
      ? (lastRunMode ?? "cool")
      : currentMode;
  return { mode, operating_mode: "manual" };
}
