import { apiRequest, shouldUseMock } from "./http";
import mockStatus from "./mock/status.json";
import type {
  AcActionRequest,
  AcStateResponse,
  OkResponse,
  PcActionRequest,
  PcActionResponse,
  PlugActionRequest,
  StatusResponse,
} from "./types";

export { ApiError, hasApiKey, shouldUseMock as isUsingMock } from "./http";

let mockAcMode: "off" | "cool" | "dry" = "cool";

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

export async function setAc(action: AcActionRequest): Promise<OkResponse> {
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
    return { ok: true };
  }
  return apiRequest<OkResponse>("/api/v1/ac", {
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
  return apiRequest<AcStateResponse>("/api/v1/ac/state");
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
