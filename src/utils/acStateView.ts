import type {
  AcLastRunMode,
  AcMode,
  AcOperatingMode,
  AcStateResponse,
  StatusResponse,
} from "@/api/types";
import { deriveAcOperatingMode } from "@/utils/acOperatingMode";

export type AcRunningFields = Pick<AcStateResponse, "power" | "running_source" | "mode">;

export interface AcStateView {
  mode: AcMode;
  power: AcStateResponse["power"];
  operatingMode: AcOperatingMode | null;
  lastRunMode: AcLastRunMode | null;
  runningFields: AcRunningFields;
}

type AcStatusSlice = Pick<
  StatusResponse,
  | "ac_mode"
  | "ac_operating_mode"
  | "ac_auto_enabled"
  | "ac_away_enabled"
  | "ac_last_run_mode"
  | "ac_estimated_running"
  | "ac_auto_state"
>;

type AcStateSlice = Pick<
  AcStateResponse,
  | "mode"
  | "power"
  | "operating_mode"
  | "auto_enabled"
  | "away_enabled"
  | "last_run_mode"
  | "running_source"
>;

function isLogicalLowPower(acState: AcStateSlice | undefined): boolean {
  return acState?.power === "off" && acState?.running_source === "logical";
}

/** SSE /status — 플러그·ac_auto_state 실시간 신호 */
function statusSuggestsRunning(status: AcStatusSlice): boolean {
  if (status.ac_estimated_running) return true;
  if (status.ac_auto_state?.state === "on") return true;
  return false;
}

function statusSuggestsOff(status: AcStatusSlice): boolean {
  if (statusSuggestsRunning(status)) return false;
  if (status.ac_auto_state?.state === "off") return true;
  return !status.ac_estimated_running;
}

/** 모드·운전 설정 — SSE /status 우선 (실시간 정본) */
function resolveMode(status: AcStatusSlice, acState: AcStateSlice | undefined): AcMode {
  return status.ac_mode ?? acState?.mode ?? "off";
}

function resolveOperatingMode(
  status: AcStatusSlice,
  acState: AcStateSlice | undefined,
): AcOperatingMode | null {
  const fromStatus = deriveAcOperatingMode(
    status.ac_operating_mode,
    status.ac_auto_enabled,
    status.ac_away_enabled,
  );
  if (fromStatus != null) return fromStatus;
  if (!acState) return null;
  return deriveAcOperatingMode(
    acState.operating_mode,
    acState.auto_enabled,
    acState.away_enabled,
  );
}

/**
 * power 합성 — status(SSE)와 /ac/state 신호를 양방향으로 맞춤.
 * logical 저전력(제습 등)은 /ac/state를 존중하고, plug·ac_auto_state는 status 우선.
 */
function resolveComposedPower(
  status: AcStatusSlice,
  acState: AcStateSlice | undefined,
): AcStateResponse["power"] {
  if (!acState) {
    return statusSuggestsRunning(status) ? "on" : "off";
  }

  if (isLogicalLowPower(acState)) {
    return "off";
  }

  const statusRunning = statusSuggestsRunning(status);
  const statusOff = statusSuggestsOff(status);
  const acPowerOn = acState.power === "on";
  const acPowerOff = acState.power === "off";

  if (acPowerOff && statusRunning) return "on";
  if (acPowerOn && statusOff) return "off";

  if (statusRunning) return "on";
  if (acPowerOn) return "on";
  if (statusOff && acPowerOff) return "off";
  if (acState.power === "on" || acState.power === "off") return acState.power;
  return statusSuggestsRunning(status) ? "on" : "off";
}

function buildRunningFields(
  mode: AcMode,
  power: AcStateResponse["power"],
  acState: AcStateSlice | undefined,
  status: AcStatusSlice,
): AcRunningFields {
  if (isLogicalLowPower(acState)) {
    return {
      mode,
      power: acState!.power,
      running_source: "logical",
    };
  }

  if (
    power === "on" &&
    acState?.power === "off" &&
    status.ac_estimated_running &&
    acState.running_source !== "logical"
  ) {
    return {
      mode,
      power: "on",
      running_source: acState.running_source ?? "plug",
    };
  }

  return {
    mode,
    power,
    running_source: acState?.running_source,
  };
}

/** /status(SSE)와 /ac/state(폴링)를 신호 합성해 UI 단일 뷰 */
export function resolveAcStateView(
  status: AcStatusSlice,
  acState: AcStateSlice | undefined,
): AcStateView {
  const mode = resolveMode(status, acState);
  const operatingMode = resolveOperatingMode(status, acState);
  const lastRunMode = acState?.last_run_mode ?? status.ac_last_run_mode ?? null;
  const power = resolveComposedPower(status, acState);

  return {
    mode,
    power,
    operatingMode,
    lastRunMode,
    runningFields: buildRunningFields(mode, power, acState, status),
  };
}
