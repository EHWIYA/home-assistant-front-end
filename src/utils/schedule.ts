import type { Schedule, StripChannelNumber } from "@/api/types";

export const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

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

export const DEFAULT_SCHEDULE_FORM = {
  name: "",
  enabled: true,
  channel_number: 1 as StripChannelNumber,
  channel_on: true,
  time_kst: "08:00",
  days_of_week: [0, 1, 2, 3, 4] as number[],
};
