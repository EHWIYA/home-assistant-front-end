import type { IndoorClimate } from "@/api/types";

export type ComfortLevel = "comfortable" | "warm" | "hot" | "cool" | "humid" | "dry";

export interface ComfortInfo {
  level: ComfortLevel;
  label: string;
  color: string;
  background: string;
}

const COMFORT: ComfortInfo = {
  level: "comfortable",
  label: "쾌적",
  color: "#7ec88a",
  background: "rgba(126, 200, 138, 0.15)",
};

export function getIndoorComfort(indoor: IndoorClimate): ComfortInfo {
  const { temperature, humidity } = indoor;

  if (humidity >= 70) {
    return {
      level: "humid",
      label: "다습",
      color: "#5b9fd4",
      background: "rgba(91, 159, 212, 0.15)",
    };
  }
  if (humidity <= 35) {
    return {
      level: "dry",
      label: "건조",
      color: "#e8b84a",
      background: "rgba(232, 184, 74, 0.15)",
    };
  }
  if (temperature >= 28) {
    return {
      level: "hot",
      label: "더움",
      color: "#e57373",
      background: "rgba(229, 115, 115, 0.12)",
    };
  }
  if (temperature >= 26) {
    return {
      level: "warm",
      label: "약간 더움",
      color: "#f0ad4e",
      background: "rgba(240, 173, 78, 0.12)",
    };
  }
  if (temperature <= 18) {
    return {
      level: "cool",
      label: "선선함",
      color: "#7eb8e8",
      background: "rgba(126, 184, 232, 0.15)",
    };
  }
  return COMFORT;
}

/** 실내 온도 arc 게이지 (18~30°C) */
export function normalizeTemperature(value: number, min = 18, max = 30): number {
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** 습도 bar (0~100%) */
export function normalizeHumidity(value: number): number {
  return Math.min(1, Math.max(0, value / 100));
}

/** 습도 comfort zone 40~70% */
export function getHumidityZoneLeft(): number {
  return 0.4;
}

export function getHumidityZoneWidth(): number {
  return 0.3;
}

export function getHumidityBarColor(humidity: number): string {
  if (humidity >= 70) return "#5b9fd4";
  if (humidity <= 35) return "#e8b84a";
  return "#7ec88a";
}

export function getTemperatureArcColor(temperature: number): string {
  if (temperature >= 28) return "#e57373";
  if (temperature >= 26) return "#f0ad4e";
  if (temperature <= 18) return "#7eb8e8";
  return "#7ec88a";
}
