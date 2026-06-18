import { apiRequest, apiRequestNoContent, shouldUseMock } from "./http";
import mockPresetsSeed from "./mock/strip-presets.json";
import type {
  StripPreset,
  StripPresetCreateBody,
  StripPresetListResponse,
  StripPresetPatchBody,
  StripStateResponse,
} from "./types";

let mockPresets: StripPreset[] = [
  ...(mockPresetsSeed as StripPreset[]),
];

export async function fetchStripPresets(): Promise<StripPreset[]> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 200));
    return mockPresets.map((p) => ({
      ...p,
      channels: p.channels.map((c) => ({ ...c })),
    }));
  }
  const res = await apiRequest<StripPresetListResponse | StripPreset[]>(
    "/api/v1/strip/presets",
  );
  if (Array.isArray(res)) return res;
  return res.presets ?? [];
}

export async function createStripPreset(
  body: StripPresetCreateBody,
): Promise<StripPreset> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 250));
    const created: StripPreset = {
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockPresets = [...mockPresets, created];
    return { ...created, channels: created.channels.map((c) => ({ ...c })) };
  }
  return apiRequest<StripPreset>("/api/v1/strip/presets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchStripPreset(
  name: string,
  body: StripPresetPatchBody,
): Promise<StripPreset> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 250));
    const idx = mockPresets.findIndex((p) => p.name === name);
    if (idx < 0) throw new Error("프리셋을 찾을 수 없습니다");
    const updated: StripPreset = {
      ...mockPresets[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    mockPresets = mockPresets.map((p, i) => (i === idx ? updated : p));
    return { ...updated, channels: updated.channels.map((c) => ({ ...c })) };
  }
  return apiRequest<StripPreset>(
    `/api/v1/strip/presets/${encodeURIComponent(name)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function deleteStripPreset(name: string): Promise<void> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 200));
    mockPresets = mockPresets.filter((p) => p.name !== name);
    return;
  }
  await apiRequestNoContent(
    `/api/v1/strip/presets/${encodeURIComponent(name)}`,
    { method: "DELETE" },
  );
}

export async function applyStripPreset(name: string): Promise<StripStateResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 300));
    const preset = mockPresets.find((p) => p.name === name);
    if (!preset) throw new Error("프리셋을 찾을 수 없습니다");
    const { fetchStripState } = await import("./strip");
    return fetchStripState();
  }
  return apiRequest<StripStateResponse>(
    `/api/v1/strip/presets/${encodeURIComponent(name)}`,
    { method: "POST" },
  );
}
