import { apiRequest, apiRequestNoContent, shouldUseMock } from "./http";
import mockSchedulesSeed from "./mock/schedules.json";
import type {
  Schedule,
  ScheduleCreateBody,
  SchedulePatchBody,
  SchedulePreviewResponse,
  ScheduleRun,
  ScheduleRunsResponse,
  StripChannelNumber,
} from "./types";

let mockSchedules: Schedule[] = [
  ...(mockSchedulesSeed as Schedule[]),
];

function nextMockId(): string {
  return `mock-schedule-${Date.now()}`;
}

export async function fetchSchedules(
  channel?: StripChannelNumber,
): Promise<Schedule[]> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 200));
    const list = mockSchedules.map((s) => ({ ...s }));
    if (channel == null) return list;
    return list.filter(
      (s) =>
        s.action_type === "channel" && s.channel_number === channel,
    );
  }
  const qs =
    channel != null
      ? `?channel=${encodeURIComponent(String(channel))}`
      : "";
  return apiRequest<Schedule[]>(`/api/v1/schedules${qs}`);
}

export async function fetchSchedulePreview(
  from: string,
  to: string,
  channel?: StripChannelNumber,
): Promise<SchedulePreviewResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 200));
    const { default: mockPreview } = await import("./mock/schedule-preview.json");
    const data = mockPreview as SchedulePreviewResponse;
    if (channel == null) return data;
    return {
      days: data.days.map((day) => ({
        ...day,
        occurrences: day.occurrences.filter(
          (o) => o.channel_number == null || o.channel_number === channel,
        ),
      })),
    };
  }
  const params = new URLSearchParams({ from, to });
  if (channel != null) params.set("channel", String(channel));
  return apiRequest<SchedulePreviewResponse>(
    `/api/v1/schedules/preview?${params.toString()}`,
  );
}

export async function createSchedule(
  body: ScheduleCreateBody,
): Promise<Schedule> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 300));
    const now = new Date().toISOString();
    const created: Schedule = {
      id: nextMockId(),
      enabled: body.enabled ?? true,
      ...body,
      created_at: now,
      updated_at: now,
    };
    mockSchedules = [...mockSchedules, created];
    return { ...created };
  }
  return apiRequest<Schedule>("/api/v1/schedules", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchSchedule(
  id: string,
  body: SchedulePatchBody,
): Promise<Schedule> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 300));
    const idx = mockSchedules.findIndex((s) => s.id === id);
    if (idx < 0) {
      throw new Error("스케줄을 찾을 수 없습니다");
    }
    const updated: Schedule = {
      ...mockSchedules[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    mockSchedules = mockSchedules.map((s, i) => (i === idx ? updated : s));
    return { ...updated };
  }
  return apiRequest<Schedule>(`/api/v1/schedules/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteSchedule(id: string): Promise<void> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 250));
    mockSchedules = mockSchedules.filter((s) => s.id !== id);
    return;
  }
  await apiRequestNoContent(
    `/api/v1/schedules/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function fetchScheduleRuns(
  id: string,
  limit = 50,
): Promise<ScheduleRun[]> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 200));
    return [
      {
        scheduled_at: new Date(Date.now() - 86_400_000).toISOString(),
        executed_at: new Date(Date.now() - 86_400_000 + 1200).toISOString(),
        success: true,
      },
    ];
  }
  const res = await apiRequest<ScheduleRunsResponse | ScheduleRun[]>(
    `/api/v1/schedules/${encodeURIComponent(id)}/runs?limit=${limit}`,
  );
  if (Array.isArray(res)) return res;
  return res.runs ?? [];
}
