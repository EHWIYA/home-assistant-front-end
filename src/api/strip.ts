import { apiRequest, shouldUseMock } from "./http";
import mockStripState from "./mock/strip-state.json";
import type {
  StripChannelControlBody,
  StripChannelNumber,
  StripStateResponse,
} from "./types";

let mockState: StripStateResponse = {
  ...(mockStripState as StripStateResponse),
};

function touchMockState(): StripStateResponse {
  mockState = {
    ...mockState,
    updated_at: new Date().toISOString(),
  };
  return { ...mockState, channels: mockState.channels.map((c) => ({ ...c })) };
}

export async function fetchStripState(): Promise<StripStateResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 200));
    return touchMockState();
  }
  return apiRequest<StripStateResponse>("/api/v1/strip/state");
}

export async function setStripChannel(
  channel: StripChannelNumber,
  body: StripChannelControlBody,
): Promise<StripStateResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 300));
    mockState = {
      ...mockState,
      channels: mockState.channels.map((c) =>
        c.channel === channel ? { ...c, on: body.on } : c,
      ),
    };
    return touchMockState();
  }
  return apiRequest<StripStateResponse>(`/api/v1/strip/channels/${channel}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
