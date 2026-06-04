import { apiRequest, shouldUseMock } from "./http";
import mockAcThresholds from "./mock/acThresholds.json";
import mockStatus from "./mock/status.json";
import type {
  AcActionRequest,
  AcActionResponse,
  AcAutoToggleRequest,
  AcAutoToggleResponse,
  AcLastRunMode,
  AcMode,
  AcOperatingMode,
  AcStateResponse,
  AcThresholdsResponse,
  PcActionRequest,
  PcActionResponse,
  PlugActionRequest,
  StatusResponse,
} from "./types";
import { operatingModeToFlags } from "@/utils/acOperatingMode";

export { ApiError, hasApiKey, shouldUseMock as isUsingMock } from "./http";

let mockAcMode: AcMode = "cool";
let mockAcAwayEnabled = false;
let mockAcOperatingMode: AcOperatingMode = "auto";

function isAcOperatingMode(value: unknown): value is AcOperatingMode {
  return value === "manual" || value === "auto" || value === "away";
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isAcMode(value: unknown): value is AcMode {
  return value === "off" || value === "auto" || value === "cool" || value === "dry";
}

function isAcLastRunMode(value: unknown): value is AcLastRunMode {
  return value === "cool" || value === "dry";
}

function syncMockStatusAcFields(status: StatusResponse): void {
  status.ac_mode = mockAcMode;
  status.ac_away_enabled = mockAcAwayEnabled;
  status.ac_operating_mode = mockAcOperatingMode;
  status.ac_auto_enabled = mockAcOperatingMode === "auto";
  if (mockAcMode === "auto") {
    status.ac_last_run_mode = status.ac_last_run_mode ?? "cool";
  } else if (mockAcMode === "cool" || mockAcMode === "dry") {
    status.ac_last_run_mode = mockAcMode;
  }
}

export async function fetchStatus(): Promise<StatusResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 200));
    const status = { ...(mockStatus as StatusResponse) };
    syncMockStatusAcFields(status);
    return status;
  }
  return apiRequest<StatusResponse>("/api/v1/status");
}

export async function setPlug(action: PlugActionRequest): Promise<void> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 300));
    (mockStatus as StatusResponse).plug.switch = action.action;
    return;
  }
  await apiRequest("/api/v1/plug", {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export async function setAc(action: AcActionRequest): Promise<AcActionResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 300));
    const status = mockStatus as StatusResponse;
    if (action.mode === "off") {
      if (mockAcMode === "cool" || mockAcMode === "dry") {
        status.ac_last_run_mode = mockAcMode;
      } else if (mockAcMode === "auto") {
        status.ac_last_run_mode = status.ac_last_run_mode ?? "cool";
      }
    }
    mockAcMode = action.mode;
    if (action.operating_mode) {
      mockAcOperatingMode = action.operating_mode;
      const flags = operatingModeToFlags(action.operating_mode);
      status.ac_auto_enabled = flags.auto_enabled;
      mockAcAwayEnabled = flags.away_enabled;
      status.ac_away_enabled = flags.away_enabled;
    } else {
      if (typeof action.auto_enabled === "boolean") {
        status.ac_auto_enabled = action.auto_enabled;
      }
      if (typeof action.away_enabled === "boolean") {
        mockAcAwayEnabled = action.away_enabled;
        status.ac_away_enabled = action.away_enabled;
      }
    }
    syncMockStatusAcFields(status);
    status.ac_auto_state = {
      state: action.mode === "off" ? "off" : "on",
      last_on:
        action.mode === "off"
          ? status.ac_auto_state?.last_on ?? null
          : new Date().toISOString().slice(0, 19).replace("T", " "),
      last_off:
        action.mode === "off"
          ? new Date().toISOString().slice(0, 19).replace("T", " ")
          : status.ac_auto_state?.last_off ?? null,
      last_transition: new Date().toISOString().slice(0, 19).replace("T", " "),
    };
    return {
      ok: true,
      applied_mode: action.mode,
      auto_enabled: status.ac_auto_enabled ?? null,
      away_enabled: status.ac_away_enabled ?? null,
      operating_mode: mockAcOperatingMode,
      partial_failure: false,
    };
  }
  return apiRequest<AcActionResponse>("/api/v1/ac", {
    method: "POST",
    body: JSON.stringify(action),
  });
}

/** @deprecated POST /api/v1/ac `{ mode, auto_enabled }` 사용 권장 */
export async function setAcAuto(
  action: AcAutoToggleRequest,
): Promise<AcAutoToggleResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 300));
    const status = mockStatus as StatusResponse;
    status.ac_auto_enabled = action.enabled;
    status.plug.switch = action.enabled ? "on" : "off";
    return {
      ok: true,
      request_id: "mock-ac-auto-toggle",
      auto_enabled: status.ac_auto_enabled ?? action.enabled,
      plug_switch: status.plug.switch,
    };
  }
  return apiRequest<AcAutoToggleResponse>("/api/v1/ac/auto", {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export async function fetchAcState(): Promise<AcStateResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 150));
    const status = mockStatus as StatusResponse;
    const plugW = status.plug.power_w ?? 0;
    const plugHigh = plugW >= 50;
    const mode = mockAcMode;
    const power: "on" | "off" = mode === "off" ? "off" : "on";
    return {
      temperature: status.indoor?.temperature ?? 27.5,
      humidity: status.indoor?.humidity ?? 50,
      mode,
      auto_enabled: status.ac_auto_enabled ?? false,
      away_enabled: mockAcAwayEnabled,
      operating_mode: mockAcOperatingMode,
      last_run_mode:
        mode === "auto" && power === "on"
          ? (status.ac_last_run_mode ?? "cool")
          : mode === "cool" || mode === "dry"
            ? mode
            : null,
      power,
      running_source:
        mode === "off" ? "plug" : plugHigh ? "plug" : "logical",
      state_consistent: true,
      state_source: "mock",
    };
  }
  const raw = await apiRequest<Record<string, unknown>>("/api/v1/ac/state");
  const normalizedTemperature =
    toFiniteNumber(raw.temperature) ?? toFiniteNumber(raw.temperature_c);
  const normalizedHumidity = toFiniteNumber(raw.humidity);
  const normalizedMode = raw.mode;
  const normalizedAutoEnabled = raw.auto_enabled ?? raw.auto_mode;
  const normalizedAwayEnabled = raw.away_enabled;
  const normalizedOperatingMode = raw.operating_mode;
  const normalizedLastRunMode = raw.last_run_mode;

  if (normalizedTemperature == null || normalizedHumidity == null) {
    console.warn("[ac] invalid /api/v1/ac/state climate fields", raw);
  }

  return {
    temperature: normalizedTemperature ?? NaN,
    humidity: normalizedHumidity ?? NaN,
    mode: isAcMode(normalizedMode) ? normalizedMode : "off",
    auto_enabled:
      typeof normalizedAutoEnabled === "boolean" ? normalizedAutoEnabled : false,
    away_enabled:
      typeof normalizedAwayEnabled === "boolean" ? normalizedAwayEnabled : false,
    operating_mode: isAcOperatingMode(normalizedOperatingMode)
      ? normalizedOperatingMode
      : null,
    last_run_mode: isAcLastRunMode(normalizedLastRunMode)
      ? normalizedLastRunMode
      : null,
    power:
      raw.power === "on" || raw.power === "off"
        ? raw.power
        : undefined,
    running_source:
      typeof raw.running_source === "string" ? raw.running_source : undefined,
    state_consistent:
      typeof raw.state_consistent === "boolean" ? raw.state_consistent : undefined,
    state_source: typeof raw.state_source === "string" ? raw.state_source : undefined,
    last_control_at:
      typeof raw.last_control_at === "string" || raw.last_control_at == null
        ? (raw.last_control_at as string | null | undefined)
        : undefined,
    last_control_result:
      raw.last_control_result === "success" || raw.last_control_result === "failed"
        ? raw.last_control_result
        : null,
  };
}

export async function fetchAcThresholds(): Promise<AcThresholdsResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 120));
    return mockAcThresholds as AcThresholdsResponse;
  }
  return apiRequest<AcThresholdsResponse>("/api/v1/ac/thresholds");
}

export async function setPc(
  action: PcActionRequest,
): Promise<PcActionResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 300));
    const status = mockStatus as StatusResponse;
    if (status.pc) {
      status.pc.switch = action.action;
      status.pc.estimated_running =
        action.action === "on" && status.pc.power_w >= 50;
    }
    return { ok: true, switch: action.action };
  }
  return apiRequest<PcActionResponse>("/api/v1/pc", {
    method: "POST",
    body: JSON.stringify(action),
  });
}
