import type { MoodCapabilitiesResponse, MoodColorName, MoodStateResponse } from "@/api/types";

/** Hue 앱 스타일 스펙트럼 프리셋 — UI 전용, color-rgb로 전송 */
export const HUE_SPECTRUM_PRESETS = [
  { hex: "#FF3B30", label: "빨강" },
  { hex: "#FF6B35", label: "주황" },
  { hex: "#FF9500", label: "오렌지" },
  { hex: "#FFCC00", label: "노랑" },
  { hex: "#34C759", label: "초록" },
  { hex: "#00C7BE", label: "청록" },
  { hex: "#32ADE6", label: "하늘" },
  { hex: "#007AFF", label: "파랑" },
  { hex: "#5856D6", label: "남색" },
  { hex: "#AF52DE", label: "보라" },
  { hex: "#FF2D55", label: "핑크" },
  { hex: "#FFFFFF", label: "흰색" },
] as const;

/** Google 어시스턴트 경유 색상·효과 */
export const MOOD_GH_COLOR_NAMES: readonly MoodColorName[] = [
  "warm",
  "cool",
  "rainbow",
];

export const MOOD_COLOR_LABELS: Record<MoodColorName, string> = {
  red: "빨강",
  blue: "파랑",
  green: "초록",
  yellow: "노랑",
  purple: "보라",
  white: "흰색",
  warm: "따뜻한 빛",
  cool: "차가운 빛",
  rainbow: "무지개",
};

export const MOOD_COLOR_SWATCH: Record<
  Exclude<MoodColorName, "rainbow">,
  string
> = {
  red: "#ff3b30",
  blue: "#007aff",
  green: "#34c759",
  yellow: "#ffcc00",
  purple: "#af52de",
  white: "#ffffff",
  warm: "#ffb347",
  cool: "#a8d8ff",
};

export function supportsMoodHs(
  capabilities: Pick<
    MoodCapabilitiesResponse,
    "color_mode" | "color_modes" | "supports_hs"
  >,
): boolean {
  if (capabilities.supports_hs === true) return true;
  if (capabilities.color_mode === "hs") return true;
  return capabilities.color_modes?.includes("hs") === true;
}

export function supportsMoodRgb(
  capabilities: Pick<
    MoodCapabilitiesResponse,
    "supports_rgb" | "color_modes"
  >,
): boolean {
  if (capabilities.supports_rgb === true) return true;
  return capabilities.color_modes?.includes("rgb") === true;
}

/** 실제 등 반영에 color-rgb가 동작함 (color-hs는 백엔드 미반영 시 대비) */
export function prefersMoodColorRgb(
  capabilities: Pick<MoodCapabilitiesResponse, "supports_rgb" | "actions">,
): boolean {
  if (capabilities.supports_rgb === true) return true;
  return hasMoodAction(capabilities, "color-rgb");
}

export function supportsMoodColorTemperature(
  capabilities: Pick<MoodCapabilitiesResponse, "color_temperature">,
): boolean {
  return capabilities.color_temperature === true;
}

export function hasMoodAction(
  capabilities: Pick<MoodCapabilitiesResponse, "actions">,
  action: string,
): boolean {
  return capabilities.actions.includes(action);
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((c) =>
      Math.max(0, Math.min(255, Math.round(c)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function parseHexColor(hex: string): [number, number, number] | null {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

/** HSV(V=100%) → hex — 밝기(V)는 별도 슬라이더 */
export function hsToHex(hue: number, saturation: number): string {
  const h = ((hue % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, saturation)) / 100;
  const v = 1;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function rgbToHs(
  r: number,
  g: number,
  b: number,
): { hue: number; saturation: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === rn) {
      hue = 60 * (((gn - bn) / delta) % 6);
    } else if (max === gn) {
      hue = 60 * ((bn - rn) / delta + 2);
    } else {
      hue = 60 * ((rn - gn) / delta + 4);
    }
  }
  if (hue < 0) hue += 360;

  const saturation = max === 0 ? 0 : (delta / max) * 100;
  return {
    hue: Math.round(hue),
    saturation: Math.round(saturation),
  };
}

export function hexToHs(hex: string): { hue: number; saturation: number } | null {
  const rgb = parseHexColor(hex);
  if (!rgb) return null;
  return rgbToHs(rgb[0], rgb[1], rgb[2]);
}

export function getMoodStateHex(
  state: Pick<MoodStateResponse, "rgb" | "hs">,
): string | null {
  const hs = state.hs;
  if (hs && hs.length >= 2) {
    return hsToHex(hs[0], hs[1]);
  }
  const rgb = state.rgb;
  if (!rgb || rgb.length < 3) return null;
  return rgbToHex(rgb[0], rgb[1], rgb[2]);
}

export function getMoodStateHs(
  state: Pick<MoodStateResponse, "rgb" | "hs">,
): { hue: number; saturation: number } | null {
  const hs = state.hs;
  if (hs && hs.length >= 2) {
    return { hue: Math.round(hs[0]), saturation: Math.round(hs[1]) };
  }
  const hex = getMoodStateHex(state);
  if (!hex) return null;
  return hexToHs(hex);
}

export function formatMoodStateSubline(
  state: Pick<
    MoodStateResponse,
    "on" | "brightness" | "color" | "rgb" | "hs"
  >,
): string {
  const parts: string[] = [];
  if (state.brightness != null) {
    parts.push(`밝기 ${Math.round(state.brightness)}%`);
  }
  if (state.color) {
    parts.push(state.color);
  } else {
    const hs = getMoodStateHs(state);
    if (hs) {
      parts.push(`H${hs.hue}° S${hs.saturation}%`);
    } else {
      const hex = getMoodStateHex(state);
      if (hex) {
        parts.push(hex.toUpperCase());
      }
    }
  }
  return parts.join(" · ");
}

export function isMoodColorName(value: string): value is MoodColorName {
  return value in MOOD_COLOR_LABELS;
}
