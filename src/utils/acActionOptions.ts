import type { AcMode, AcOperatingMode } from "@/api/types";

/** ② 동작 — HA 자동 선택 (mode=auto) */
export const AC_AI_ACTION_LABEL = "인공지능";

export interface AcActionOption {
  mode: AcMode;
  label: string;
  tone: "off" | "auto" | "cool" | "dry";
  blocked?: boolean;
  blockReason?: string;
}

export function getOperatingSectionTitle(): string {
  return "제어 방식";
}

export function getActionSectionTitle(
  operatingMode: AcOperatingMode | null,
): string {
  if (operatingMode === "auto" || operatingMode === "away") {
    return "냉방 · 제습";
  }
  return "동작";
}

/** 운전모드에 맞는 동작 버튼 — 자동/외출 3개, 수동 3~4개 */
export function getAcActionOptions(
  operatingMode: AcOperatingMode | null,
  currentMode: AcMode,
): AcActionOption[] {
  if (operatingMode === "manual") {
    const options: AcActionOption[] = [
      { mode: "off", label: "끄기", tone: "off" },
      { mode: "cool", label: "냉방", tone: "cool" },
      { mode: "dry", label: "제습", tone: "dry" },
    ];
    if (currentMode === "auto") {
      options.unshift({ mode: "auto", label: "자동", tone: "auto" });
    }
    return options;
  }

  if (operatingMode === "auto" || operatingMode === "away") {
    return [
      { mode: "auto", label: AC_AI_ACTION_LABEL, tone: "auto" },
      { mode: "cool", label: "냉방", tone: "cool" },
      { mode: "dry", label: "제습", tone: "dry" },
    ];
  }

  return [
    { mode: "off", label: "끄기", tone: "off" },
    { mode: "auto", label: AC_AI_ACTION_LABEL, tone: "auto" },
    { mode: "cool", label: "냉방", tone: "cool" },
    { mode: "dry", label: "제습", tone: "dry" },
  ];
}
