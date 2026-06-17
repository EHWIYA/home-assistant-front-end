import { apiRequest, shouldUseMock } from "./http";
import mockCapabilities from "./mock/mood-capabilities.json";
import mockMeta from "./mock/mood-meta.json";
import mockState from "./mock/mood-state.json";
import type {
  MoodActionResponse,
  MoodBrightnessRequest,
  MoodCapabilitiesResponse,
  MoodColorHsRequest,
  MoodColorRgbRequest,
  MoodColorRequest,
  MoodColorTemperatureRequest,
  MoodMetaResponse,
  MoodPowerRequest,
  MoodStateResponse,
} from "./types";

function assertMoodActionOk(response: MoodActionResponse): MoodActionResponse {
  if (!response.ok) {
    throw new Error(response.command ?? "무드등 명령이 적용되지 않았습니다");
  }
  return response;
}

export async function fetchMoodMeta(): Promise<MoodMetaResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 150));
    return mockMeta as MoodMetaResponse;
  }
  return apiRequest<MoodMetaResponse>("/api/v1/mood/meta");
}

export async function fetchMoodCapabilities(): Promise<MoodCapabilitiesResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 150));
    const data = mockCapabilities as MoodCapabilitiesResponse;
    return {
      ...data,
      brightness_range: data.brightness_range as [number, number],
    };
  }
  return apiRequest<MoodCapabilitiesResponse>("/api/v1/mood/capabilities");
}

export async function fetchMoodState(): Promise<MoodStateResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 150));
    return mockState as MoodStateResponse;
  }
  return apiRequest<MoodStateResponse>("/api/v1/mood/state");
}

export async function postMoodPower(
  body: MoodPowerRequest,
): Promise<MoodActionResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 400));
    const command = body.on ? "자취방 무드등 켜줘" : "자취방 무드등 꺼줘";
    return { ok: true, command, control_path: "home_assistant" };
  }
  return apiRequest<MoodActionResponse>("/api/v1/mood/power", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postMoodBrightness(
  body: MoodBrightnessRequest,
): Promise<MoodActionResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 400));
    return {
      ok: true,
      command: `자취방 무드등 밝기 ${body.percent}%로 해줘`,
      control_path: "home_assistant",
    };
  }
  return apiRequest<MoodActionResponse>("/api/v1/mood/brightness", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postMoodColor(
  body: MoodColorRequest,
): Promise<MoodActionResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 400));
    return {
      ok: true,
      command: `자취방 무드등 ${body.name}으로 해줘`,
      control_path: "google_assistant_sdk",
    };
  }
  return apiRequest<MoodActionResponse>("/api/v1/mood/color", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postMoodColorHs(
  body: MoodColorHsRequest,
): Promise<MoodActionResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 400));
    return {
      ok: true,
      command: `HS ${body.hue}° ${body.saturation}%`,
      control_path: "home_assistant",
    };
  }
  return assertMoodActionOk(
    await apiRequest<MoodActionResponse>("/api/v1/mood/color-hs", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

export async function postMoodColorRgb(
  body: MoodColorRgbRequest,
): Promise<MoodActionResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 400));
    const hex =
      body.hex ??
      (body.r != null && body.g != null && body.b != null
        ? `#${[body.r, body.g, body.b].map((c) => c.toString(16).padStart(2, "0")).join("")}`
        : "#ffffff");
    return {
      ok: true,
      command: `RGB ${hex}`,
      control_path: "home_assistant",
    };
  }
  return assertMoodActionOk(
    await apiRequest<MoodActionResponse>("/api/v1/mood/color-rgb", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

export async function postMoodColorTemperature(
  body: MoodColorTemperatureRequest,
): Promise<MoodActionResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 400));
    const label = body.mode === "warm" ? "따뜻한 색" : "차가운 색";
    return {
      ok: true,
      command: `자취방 무드등 ${label}으로 해줘`,
      control_path: "google_assistant_sdk",
    };
  }
  return apiRequest<MoodActionResponse>("/api/v1/mood/color-temperature", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
