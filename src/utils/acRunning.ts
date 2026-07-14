import type { AcStateResponse } from "@/api/types";

export type AcPowerState = "on" | "off";

/** GET /api/v1/ac/state → running_source (OpenAPI 정본 우선) */
export type AcRunningSource = "plug" | "logical" | (string & {});

export interface AcRunningBadge {
  label: string;
  variant: "ok" | "warn";
  title: string;
}

type AcRunningFields = Pick<AcStateResponse, "power" | "running_source" | "mode">;

function isLogicalLowPower(acState: AcRunningFields): boolean {
  return acState.power === "off" && acState.running_source === "logical";
}

function isComposedOn(acState: AcRunningFields): boolean {
  return acState.power === "on";
}

export interface AcRunningBadgeOptions {
  /** power_stale 또는 confidence=low */
  uncertain?: boolean;
  /** medium + logical 보조 문구 강화용 */
  confidence?: "high" | "medium" | "low";
}

/** /ac/state 기준 가동 배지. 미수신 시 plug 50W 추정만 fallback. */
export function getAcRunningBadge(
  acState: AcRunningFields | undefined,
  plugEstimatedRunning?: boolean,
  options: AcRunningBadgeOptions = {},
): AcRunningBadge | null {
  if (options.uncertain) {
    return {
      label: "확인 중",
      variant: "warn",
      title:
        "전력 센서 미갱신 또는 가동 신뢰도 낮음 — 켜짐/꺼짐을 단정하지 않습니다.",
    };
  }

  if (acState && isComposedOn(acState)) {
    const src = acState.running_source;
    return {
      label: "가동 중",
      variant: "ok",
      title:
        src === "plug"
          ? "API 합성 가동 — 콘센트 전력(≥50W) 등 plug 근거"
          : src
            ? `API 합성 가동 — running_source: ${src}`
            : "API 합성 가동(power=on)",
    };
  }

  if (acState && isLogicalLowPower(acState)) {
    const mediumLogical = options.confidence === "medium";
    return {
      label: mediumLogical ? "논리 ON(저전력)" : "가동 중(저전력)",
      variant: "warn",
      title: mediumLogical
        ? "논리 ON (저전력/플러그 미달) — IR·ac_auto_state 근거. 플러그 임계 미만."
        : "power=off 이지만 IR·ac_auto_state 등 logical 근거로 가동. 플러그 50W만으로는 미가동으로 보일 수 있음.",
    };
  }

  if (acState?.power === "off") {
    return null;
  }

  if (plugEstimatedRunning) {
    return {
      label: "가동 중(추정)",
      variant: "ok",
      title:
        "ac/state 미반영 — status.plug 전력 50W 초과만. IR·logical 가동은 /ac/state 조회 후 표시",
    };
  }

  return null;
}

/** 홈 요약 한 줄용 짧은 라벨 */
export function getAcRunningSummaryLabel(
  acState: AcRunningFields | undefined,
  plugEstimatedRunning?: boolean,
  options: AcRunningBadgeOptions = {},
): string | null {
  const badge = getAcRunningBadge(acState, plugEstimatedRunning, options);
  if (!badge) {
    return null;
  }
  if (badge.label === "확인 중") {
    return "확인 중";
  }
  if (badge.label === "가동 중(저전력)" || badge.label === "논리 ON(저전력)") {
    return "저전력 가동";
  }
  if (badge.label === "가동 중(추정)") {
    return "가동(추정)";
  }
  return "가동";
}
