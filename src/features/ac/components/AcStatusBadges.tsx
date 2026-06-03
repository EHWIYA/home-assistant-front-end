import { Badge } from "@/components/status/Badge";
import type { AcStateResponse, StatusResponse } from "@/api/types";
import {
  getAcAutoEnabledLabel,
  getAcAutoTransitionBadge,
} from "@/utils/acAuto";
import { getAcAutoEnabledVariant } from "@/utils/acAutoBadge";
import { getAcRunningBadge } from "@/utils/acRunning";
import shared from "@/components/status/statusPage.module.css";

interface AcStatusBadgesProps {
  data: Pick<
    StatusResponse,
    "ac_auto_enabled" | "ac_auto_state" | "ac_estimated_running"
  >;
  acState?: Pick<AcStateResponse, "power" | "running_source" | "mode">;
  showSyncWarning: boolean;
  syncWarningTitle?: string;
}

export function AcStatusBadges({
  data,
  acState,
  showSyncWarning,
  syncWarningTitle = "mode·power·ac_auto_state 정합성 확인 중입니다.",
}: AcStatusBadgesProps) {
  const transition = getAcAutoTransitionBadge(data.ac_auto_state);
  const runningBadge = getAcRunningBadge(acState, data.ac_estimated_running);

  return (
    <div className={shared.badgeRow}>
      <Badge
        variant={getAcAutoEnabledVariant(data.ac_auto_enabled)}
        title="HA 자동 ON/OFF 마스터 상태"
      >
        {getAcAutoEnabledLabel(data.ac_auto_enabled)}
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
