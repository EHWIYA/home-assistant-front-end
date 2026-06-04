import { Badge } from "@/components/status/Badge";
import type { AcStateResponse, StatusResponse } from "@/api/types";
import {
  getAcAutoEnabledLabel,
  getAcAutoTransitionBadge,
} from "@/utils/acAuto";
import { getAcAutoEnabledVariant } from "@/utils/acAutoBadge";
import { getAcAwayEnabledLabel } from "@/utils/acMode";
import { getAcRunningBadge } from "@/utils/acRunning";
import shared from "@/components/status/statusPage.module.css";

interface AcStatusBadgesProps {
  data: Pick<
    StatusResponse,
    | "ac_auto_enabled"
    | "ac_auto_state"
    | "ac_estimated_running"
    | "ac_away_enabled"
    | "ac_mode"
  >;
  acState?: Pick<
    AcStateResponse,
    "power" | "running_source" | "mode" | "auto_enabled" | "away_enabled"
  >;
  showSyncWarning: boolean;
  syncWarningTitle?: string;
}

export function AcStatusBadges({
  data,
  acState,
  showSyncWarning,
  syncWarningTitle = "mode·power 정합성 확인 중입니다.",
}: AcStatusBadgesProps) {
  const transition = getAcAutoTransitionBadge(data.ac_auto_state);
  const runningBadge = getAcRunningBadge(acState, data.ac_estimated_running);
  const awayEnabled = acState?.away_enabled ?? data.ac_away_enabled;
  const autoEnabled = acState?.auto_enabled ?? data.ac_auto_enabled;

  return (
    <div className={shared.badgeRow}>
      <Badge
        variant={getAcAutoEnabledVariant(autoEnabled)}
        title="HA 자동 ON/OFF 마스터 — POST /ac auto_enabled"
      >
        {getAcAutoEnabledLabel(autoEnabled)}
      </Badge>
      <Badge
        variant={awayEnabled === true ? "ok" : awayEnabled === false ? "muted" : "warn"}
        title="HA 외출 스마트 모드 — 켜지면 자동제어보다 우선"
      >
        {getAcAwayEnabledLabel(awayEnabled)}
      </Badge>
      {transition.kind === "transition" ? (
        <Badge variant="muted" title={transition.title}>
          {transition.label}
        </Badge>
      ) : (
        <Badge variant="muted">자동 기록 없음</Badge>
      )}
      {runningBadge ? (
        <Badge variant={runningBadge.variant} title={runningBadge.title}>
          {runningBadge.label}
        </Badge>
      ) : null}
      {showSyncWarning ? (
        <Badge variant="warn" title={syncWarningTitle}>
          동기화 중
        </Badge>
      ) : null}
    </div>
  );
}
