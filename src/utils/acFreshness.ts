import type {
  AcRunningConfidence,
  AcStateResponse,
  StatusResponse,
} from "@/api/types";

type StatusFreshness = Pick<StatusResponse, "plug" | "ac_running_confidence">;
type AcStateFreshness = Pick<
  AcStateResponse,
  "power_stale" | "ac_running_confidence" | "power_age_seconds" | "power_updated_at"
>;

/** plug 또는 /ac/state의 power_stale. 필드 없으면 false(구 API 호환). */
export function resolvePowerStale(
  status: StatusFreshness,
  acState?: AcStateFreshness,
): boolean {
  if (typeof acState?.power_stale === "boolean") {
    return acState.power_stale;
  }
  if (typeof status.plug.power_stale === "boolean") {
    return status.plug.power_stale;
  }
  return false;
}

export function resolveAcRunningConfidence(
  status: StatusFreshness,
  acState?: AcStateFreshness,
): AcRunningConfidence | undefined {
  if (
    acState?.ac_running_confidence === "high" ||
    acState?.ac_running_confidence === "medium" ||
    acState?.ac_running_confidence === "low"
  ) {
    return acState.ac_running_confidence;
  }
  if (
    status.ac_running_confidence === "high" ||
    status.ac_running_confidence === "medium" ||
    status.ac_running_confidence === "low"
  ) {
    return status.ac_running_confidence;
  }
  return undefined;
}

/**
 * 전력 stale 또는 confidence=low 이면 가동 ON/OFF를 단정하지 않음.
 * OpenAPI: power_stale·low 시 PWA는「꺼짐」확정 금지.
 */
export function isAcRunningUncertain(
  status: StatusFreshness,
  acState?: AcStateFreshness,
): boolean {
  if (resolvePowerStale(status, acState)) {
    return true;
  }
  return resolveAcRunningConfidence(status, acState) === "low";
}

export function getAcUncertaintyBannerTitle(
  status: StatusFreshness,
  acState?: AcStateFreshness,
): string {
  const age =
    acState?.power_age_seconds ?? status.plug.power_age_seconds ?? null;
  const confidence = resolveAcRunningConfidence(status, acState);
  const parts: string[] = [];
  if (resolvePowerStale(status, acState)) {
    parts.push("power_stale");
  }
  if (confidence === "low") {
    parts.push("confidence=low");
  } else if (confidence) {
    parts.push(`confidence=${confidence}`);
  }
  if (typeof age === "number" && Number.isFinite(age)) {
    parts.push(`age=${Math.round(age)}s`);
  }
  return parts.length > 0 ? parts.join(" · ") : "가동 상태 불확실";
}

/**
 * SSE payload에 freshness가 빠지면 직전 캐시를 보존 (가짜「확실 OFF」방지).
 * 다음 이벤트에 필드가 오면 새 값으로 덮어씀.
 */
export function mergeStatusFreshness(
  previous: StatusResponse | undefined,
  next: StatusResponse,
): StatusResponse {
  if (!previous) {
    return next;
  }

  const plug = { ...next.plug };
  if (
    typeof plug.power_stale !== "boolean" &&
    typeof previous.plug.power_stale === "boolean"
  ) {
    plug.power_stale = previous.plug.power_stale;
  }
  if (
    (plug.power_age_seconds == null || Number.isNaN(plug.power_age_seconds)) &&
    typeof previous.plug.power_age_seconds === "number"
  ) {
    plug.power_age_seconds = previous.plug.power_age_seconds;
  }
  if (plug.power_updated_at == null && previous.plug.power_updated_at != null) {
    plug.power_updated_at = previous.plug.power_updated_at;
  }

  const confidence =
    next.ac_running_confidence ?? previous.ac_running_confidence;

  return {
    ...next,
    plug,
    ac_running_confidence: confidence,
  };
}
