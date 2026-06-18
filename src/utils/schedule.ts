import type {
  Schedule,
  ScheduleHolidayMode,
  StripChannelNumber,
} from "@/api/types";

export const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export const HOLIDAY_MODE_LABELS: Record<ScheduleHolidayMode, string> = {
  skip: "공휴일 건너뛰기",
  run: "공휴일에도 실행",
};

export type Time12hPeriod = "AM" | "PM";

export interface Time12hParts {
  hour12: number;
  minute: number;
  period: Time12hPeriod;
}

export function timeKstTo12h(timeKst: string): Time12hParts | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeKst);
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  const period: Time12hPeriod = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, minute, period };
}

export function time12hToKst(parts: Time12hParts): string | null {
  const { hour12, minute, period } = parts;
  if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) return null;
  let hour24 = hour12 % 12;
  if (period === "PM") hour24 += 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatTimeKst12h(timeKst: string): string {
  const parts = timeKstTo12h(timeKst);
  if (!parts) return timeKst;
  const periodLabel = parts.period === "AM" ? "오전" : "오후";
  return `${periodLabel} ${parts.hour12}:${String(parts.minute).padStart(2, "0")}`;
}

export function formatDaysOfWeek(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return "매일";
  if (
    sorted.length === 5 &&
    sorted.every((d, i) => d === i)
  ) {
    return "평일";
  }
  return sorted
    .filter((d) => d >= 0 && d <= 6)
    .map((d) => WEEKDAY_LABELS[d])
    .join(" ");
}

export function formatScheduleAction(schedule: Schedule): string {
  if (schedule.action_type === "preset") {
    return `프리셋 ${schedule.preset_name ?? "—"}`;
  }
  const ch = schedule.channel_number ?? "?";
  return `채널 ${ch} ${schedule.channel_on ? "ON" : "OFF"}`;
}

export function isValidTimeKst(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function parseChannelNumber(value: number): StripChannelNumber | null {
  if (value >= 1 && value <= 4) return value as StripChannelNumber;
  return null;
}

export function parseChannelRouteParam(
  value: string | undefined,
): StripChannelNumber | null {
  if (!value) return null;
  return parseChannelNumber(Number(value));
}

export const DEFAULT_SCHEDULE_FORM = {
  name: "",
  enabled: true,
  channel_number: 1 as StripChannelNumber,
  channel_on: true,
  preset_name: "",
  action_type: "channel" as const,
  time_kst: "08:00",
  days_of_week: [0, 1, 2, 3, 4] as number[],
  recurrence_type: "weekly" as const,
  holiday_mode: "skip" as ScheduleHolidayMode,
  include_substitute: true,
};
