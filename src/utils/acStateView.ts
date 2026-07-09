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

function statusSuggestsRunning(status: AcStatusSlice): boolean {
  if (status.ac_estimated_running) return true;
  if (status.ac_auto_state?.state === "on") return true;
  return false;
}

function acStateSuggestsOff(
  acState: Pick<AcStateResponse, "power" | "mode">,
): boolean {
  return acState.power === "off" || acState.mode === "off";
}

/** stale /ac/state가 SSE /status보다 늦을 때 status 쪽을 우선 */
function shouldPreferStatusOverAcState(
  status: AcStatusSlice,
  acState: AcStateSlice,
): boolean {
  if (acState.running_source === "logical") return false;
  if (acState.state_consistent === true && !acStateSuggestsOff(acState)) {
    return false;
  }
  return acStateSuggestsOff(acState) && statusSuggestsRunning(status);
}

function inferPowerFromStatus(
  status: AcStatusSlice,
  acState: AcStateSlice | undefined,
  preferStatus: boolean,
): AcStateResponse["power"] {
  if (!preferStatus && acState?.power != null) {
    return acState.power;
  }
  if (acState?.running_source === "logical" && acState.power === "off") {
    return "off";
  }
  if (status.ac_estimated_running) return "on";
  if (status.ac_auto_state?.state === "on") return "on";
  return acState?.power;
}

function buildRunningFields(
  mode: AcMode,
  power: AcStateResponse["power"],
  acState: AcStateSlice | undefined,
  status: AcStatusSlice,
  preferStatus: boolean,
): AcRunningFields {
  if (
    preferStatus &&
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

function deriveOperatingMode(
  operatingMode: AcOperatingMode | null | undefined,
  autoEnabled: boolean | null | undefined,
  awayEnabled: boolean | null | undefined,
): AcOperatingMode | null {
  return deriveAcOperatingMode(operatingMode, autoEnabled, awayEnabled);
}

type AcStateSlice = Pick<
  AcStateResponse,
  | "mode"
  | "power"
  | "operating_mode"
  | "auto_enabled"
  | "away_enabled"
  | "last_run_mode"
  | "running_source"
  | "state_consistent"
>;

/** /status(SSE)와 /ac/state(폴링)를 병합해 UI에 쓸 단일 뷰 */
export function resolveAcStateView(
  status: AcStatusSlice,
  acState: AcStateSlice | undefined,
): AcStateView {
  if (!acState) {
    const mode = status.ac_mode ?? "off";
    const power = inferPowerFromStatus(status, undefined, true);
    return {
      mode,
      power,
      operatingMode: deriveOperatingMode(
        status.ac_operating_mode,
        status.ac_auto_enabled,
        status.ac_away_enabled,
      ),
      lastRunMode: status.ac_last_run_mode ?? null,
      runningFields: buildRunningFields(mode, power, undefined, status, true),
    };
  }

  const preferStatus = shouldPreferStatusOverAcState(status, acState);

  const mode = preferStatus
    ? (status.ac_mode ?? acState.mode ?? "off")
    : (acState.mode ?? status.ac_mode ?? "off");

  const operatingMode = preferStatus
    ? deriveOperatingMode(
        status.ac_operating_mode,
        status.ac_auto_enabled,
        status.ac_away_enabled,
      )
    : deriveOperatingMode(
        acState.operating_mode ?? status.ac_operating_mode,
        acState.auto_enabled ?? status.ac_auto_enabled,
        acState.away_enabled ?? status.ac_away_enabled,
      );

  const power = inferPowerFromStatus(status, acState, preferStatus);
  const lastRunMode = acState.last_run_mode ?? status.ac_last_run_mode ?? null;

  return {
    mode,
    power,
    operatingMode,
    lastRunMode,
    runningFields: buildRunningFields(
      mode,
      power,
      acState,
      status,
      preferStatus,
    ),
  };
}
