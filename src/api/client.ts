import { apiRequest, shouldUseMock } from "./http";
import mockStatus from "./mock/status.json";
import type {
  AcActionRequest,
  OkResponse,
  PcActionRequest,
  PcActionResponse,
  PlugActionRequest,
  StatusResponse,
} from "./types";

export { ApiError, hasApiKey, shouldUseMock as isUsingMock } from "./http";

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
    return { ok: true };
  }
  return apiRequest<OkResponse>("/api/v1/ac", {
    method: "POST",
    body: JSON.stringify(action),
  });
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
