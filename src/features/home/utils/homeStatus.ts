import type { AcStateResponse, PcStatus, StatusResponse } from "@/api/types";
import type { StripStateResponse } from "@/api/types";
import { getAcAutoEnabledLabel } from "@/utils/acAuto";
import { getAcModeDisplayText } from "@/utils/acMode";
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
  const running = getAcRunningBadge(acState, status.ac_estimated_running);
  const modeText = getAcModeDisplayText({
    mode,
    power: acState?.power,
    lastRunMode: acState?.last_run_mode ?? status.ac_last_run_mode ?? null,
  });

  if (running?.label === "가동 중(저전력)") {
    return { label: "저전력 가동", tone: "warn" };
  }

  if (running) {
    if (mode === "cool") return { label: "냉방 중", tone: "active" };
    if (mode === "dry") return { label: "제습 중", tone: "active" };
    if (mode === "auto") {
      if (modeText.includes("냉방")) return { label: "자동 · 냉방", tone: "active" };
      if (modeText.includes("제습")) return { label: "자동 · 제습", tone: "active" };
      return { label: "자동 가동", tone: "active" };
    }
    if (running.label === "가동 중(추정)") {
      return { label: "가동(추정)", tone: "warn" };
    }
    return { label: "가동 중", tone: "active" };
  }

  if (mode === "off" || modeText === "끄기") {
    return { label: "꺼짐", tone: "idle" };
  }

  return { label: modeText, tone: "idle" };
}

export function getAcHomeSecondaryLine(status: StatusResponse): string {
  const parts = [formatPowerW(status.plug.power_w)];
  const autoLabel = getAcAutoEnabledLabel(status.ac_auto_enabled);
  if (autoLabel === "자동제어 켜짐") {
    parts.push("자동 ON");
  } else if (autoLabel === "자동제어 꺼짐") {
    parts.push("자동 OFF");
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
