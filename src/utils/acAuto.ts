import type { AcAutoState } from "@/api/types";

const KO_LOCALE = "ko-KR";

/** API 초기값·미기록 — `00:00:00` 포함 시 기록 없음으로 표시 */
export function isAcAutoTimestampAbsent(
  value: string | null | undefined,
): boolean {
  if (value == null || value.trim() === "") return true;
  return /\b00:00:00\b/.test(value);
}

/** KST `YYYY-MM-DD HH:MM:SS` → 로컬 표시 */
export function formatAcAutoKst(value: string): string {
  const trimmed = value.trim();
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");
  const date = new Date(
    /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)
      ? normalized
      : `${normalized}+09:00`,
  );
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(KO_LOCALE, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAcAutoTransition(
  lastTransition: string | null | undefined,
): string {
  if (isAcAutoTimestampAbsent(lastTransition)) return "기록 없음";
  return formatAcAutoKst(lastTransition!);
}

/** 자동 on/off 배지용 — `last_transition` null·미기록이면 기록 없음 */
export function hasAcAutoTransitionRecord(
  autoState: AcAutoState | null | undefined,
): boolean {
  if (!autoState) return false;
  if (autoState.state !== "on" && autoState.state !== "off") return false;
  return !isAcAutoTimestampAbsent(autoState.last_transition);
}

export type AcAutoTransitionBadge =
  | { kind: "transition"; label: string; title?: string }
  | { kind: "no_record" };

/** GET /status `ac_auto_state` → 자동 on/off 배지 (가동 상태와 분리) */
export function getAcAutoTransitionBadge(
  autoState: AcAutoState | null | undefined,
): AcAutoTransitionBadge {
  if (!hasAcAutoTransitionRecord(autoState)) {
    return { kind: "no_record" };
  }
  const state = autoState!.state;
  const verb = state === "on" ? "on" : "off";
  const at = formatAcAutoKst(autoState!.last_transition!);
  return {
    kind: "transition",
    label: `자동 ${verb} · ${at}`,
    title: buildAcAutoHistoryTitle(autoState),
  };
}

export function getAcAutoEnabledLabel(
  enabled: boolean | null | undefined,
): string {
  if (enabled === true) return "자동제어 켜짐";
  if (enabled === false) return "자동제어 꺼짐";
  return "상태 알 수 없음";
}

export function buildAcAutoHistoryTitle(
  autoState: AcAutoState | null | undefined,
): string | undefined {
  if (!autoState) return undefined;
  const parts: string[] = [];
  if (!isAcAutoTimestampAbsent(autoState.last_on)) {
    parts.push(`마지막 ON: ${formatAcAutoKst(autoState.last_on!)}`);
  }
  if (!isAcAutoTimestampAbsent(autoState.last_off)) {
    parts.push(`마지막 OFF: ${formatAcAutoKst(autoState.last_off!)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
