import { apiRequest, shouldUseMock } from "./http";
import mockStatus from "./mock/status.json";
import type {
  AcActionRequest,
  AcActionResponse,
  AcAutoToggleRequest,
  AcAutoToggleResponse,
  AcStateResponse,
  PcActionRequest,
  PcActionResponse,
  PlugActionRequest,
  StatusResponse,
} from "./types";

export { ApiError, hasApiKey, shouldUseMock as isUsingMock } from "./http";

let mockAcMode: "off" | "cool" | "dry" = "cool";

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

export async function fetchStatus(): Promise<StatusResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 200));
    return { ...(mockStatus as StatusResponse) };
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
    mockAcMode = action.mode;
    (mockStatus as StatusResponse).ac_auto_state = {
      state: action.mode === "off" ? "off" : "on",
      last_on:
        action.mode === "off"
          ? (mockStatus as StatusResponse).ac_auto_state?.last_on ?? null
          : new Date().toISOString().slice(0, 19).replace("T", " "),
      last_off:
        action.mode === "off"
          ? new Date().toISOString().slice(0, 19).replace("T", " ")
          : (mockStatus as StatusResponse).ac_auto_state?.last_off ?? null,
      last_transition: new Date().toISOString().slice(0, 19).replace("T", " "),
    };
    return { ok: true, applied_mode: action.mode, partial_failure: false };
  }
  return apiRequest<AcActionResponse>("/api/v1/ac", {
    method: "POST",
    body: JSON.stringify(action),
  });
}

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
      auto_enabled: status.ac_auto_enabled,
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
    return {
      temperature: status.indoor?.temperature ?? 27.5,
      humidity: status.indoor?.humidity ?? 50,
      mode: mockAcMode,
      auto_mode: status.ac_auto_enabled ?? false,
    };
  }
  const raw = await apiRequest<Record<string, unknown>>("/api/v1/ac/state");
  const normalizedTemperature =
    toFiniteNumber(raw.temperature) ?? toFiniteNumber(raw.temperature_c);
  const normalizedHumidity = toFiniteNumber(raw.humidity);
  const normalizedMode = raw.mode;
  const normalizedAutoMode = raw.auto_mode;

  if (normalizedTemperature == null || normalizedHumidity == null) {
    console.warn("[ac] invalid /api/v1/ac/state climate fields", raw);
  }

  return {
    temperature: normalizedTemperature ?? NaN,
    humidity: normalizedHumidity ?? NaN,
    mode:
      normalizedMode === "off" || normalizedMode === "cool" || normalizedMode === "dry"
        ? normalizedMode
        : "off",
    auto_mode: typeof normalizedAutoMode === "boolean" ? normalizedAutoMode : false,
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
