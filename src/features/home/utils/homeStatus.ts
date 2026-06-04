import type { AcStateResponse, PcStatus, StatusResponse } from "@/api/types";
import type { StripStateResponse } from "@/api/types";
import {
  deriveAcOperatingMode,
  getAcOperatingModeLabel,
} from "@/utils/acOperatingMode";
import { getAcPrimaryStatusLabel, isAcPowerOff } from "@/utils/acMode";
import { getAcRunningBadge } from "@/utils/acRunning";
import { formatPowerW } from "@/utils/power";

export type HomeStatusTone = "active" | "idle" | "warn" | "danger";

export interface HomeStatusLine {
  label: string;
  tone: HomeStatusTone;
}

export function getAcHomePrimaryStatus(
  status: StatusResponse,
  acState: AcStateResponse | undefined,
): HomeStatusLine {
  const mode = acState?.mode ?? status.ac_mode ?? "off";
  const power = acState?.power;
  const lastRunMode = acState?.last_run_mode ?? status.ac_last_run_mode ?? null;
  const acAutoState = status.ac_auto_state;
  const operatingMode = deriveAcOperatingMode(
    acState?.operating_mode ?? status.ac_operating_mode,
    acState?.auto_enabled ?? status.ac_auto_enabled,
    acState?.away_enabled ?? status.ac_away_enabled,
  );
  const runningBadge = getAcRunningBadge(acState, status.ac_estimated_running);
  const isLowPowerRunning = runningBadge?.label === "가동 중(저전력)";
  const isRunning = runningBadge != null && !isLowPowerRunning;

  const label = getAcPrimaryStatusLabel({
    mode,
    power,
    lastRunMode,
    operatingMode,
    acAutoState,
    isRunning: isRunning || isLowPowerRunning,
    isLowPowerRunning,
  });

  if (isAcPowerOff(power, acAutoState)) {
    return { label, tone: "idle" };
  }
  if (isLowPowerRunning) {
    return { label, tone: "warn" };
  }
  if (isRunning && power === "on") {
    return { label, tone: "active" };
  }
  if (mode === "off") {
    return { label: "꺼짐", tone: "idle" };
  }
  return { label, tone: "idle" };
}

export function getAcHomeSecondaryLine(status: StatusResponse): string {
  const parts = [formatPowerW(status.plug.power_w)];
  const operatingLabel = getAcOperatingModeLabel(
    deriveAcOperatingMode(
      status.ac_operating_mode,
      status.ac_auto_enabled,
      status.ac_away_enabled,
    ),
  );
  if (operatingLabel !== "—") {
    parts.push(operatingLabel);
  }
  return parts.join(" · ");
}

export function getPcHomePrimaryStatus(pc: PcStatus): HomeStatusLine {
  if (!pc.online) {
    return { label: "오프라인", tone: "danger" };
  }
  if (pc.switch === "unavailable" || pc.switch === "unknown") {
    return { label: "상태 불명", tone: "warn" };
  }
  if (pc.switch === "off") {
    return { label: "꺼짐", tone: "idle" };
  }
  if (pc.estimated_running) {
    return { label: "가동 중", tone: "active" };
  }
  return { label: "대기", tone: "idle" };
}

export function getPcHomeSecondaryLine(pc: PcStatus): string {
  const parts = [formatPowerW(pc.power_w)];
  parts.push(pc.online ? "온라인" : "오프라인");
  return parts.join(" · ");
}

export function getStripHomePrimaryStatus(
  strip: StripStateResponse | null,
  loading: boolean,
): HomeStatusLine {
  if (loading) {
    return { label: "불러오는 중…", tone: "idle" };
  }
  if (!strip) {
    return { label: "상태 없음", tone: "warn" };
  }
  if (!strip.online) {
    return { label: "오프라인", tone: "danger" };
  }
  const onCount = strip.channels.filter((ch) => ch.on === true).length;
  return {
    label: `${onCount}/${strip.channels.length} ON`,
    tone: onCount > 0 ? "active" : "idle",
  };
}

export function getStripHomeSecondaryLine(
  strip: StripStateResponse | null,
): string {
  if (!strip) return "채널 정보 없음";
  if (!strip.online) return "연결 확인 필요";
  return "탭하여 채널·스케줄 관리";
}
