import { Badge } from "@/components/status/Badge";
import type { AcOperatingMode, AcStateResponse, StatusResponse } from "@/api/types";
import { getAcAutoTransitionBadge } from "@/utils/acAuto";
import { getAcModeDisplayText } from "@/utils/acMode";
import { getAcOperatingModeLabel } from "@/utils/acOperatingMode";
import { getAcRunningBadge } from "@/utils/acRunning";
import { resolveAcStateView } from "@/utils/acStateView";
import shared from "@/components/status/statusPage.module.css";

interface AcStatusBadgesProps {
  data: Pick<
    StatusResponse,
    | "ac_operating_mode"
    | "ac_auto_enabled"
    | "ac_auto_state"
    | "ac_estimated_running"
    | "ac_away_enabled"
    | "ac_mode"
    | "ac_last_run_mode"
  >;
  acState?: Pick<
    AcStateResponse,
    | "power"
    | "running_source"
    | "mode"
    | "operating_mode"
    | "auto_enabled"
    | "away_enabled"
    | "last_run_mode"
  >;
  showSyncWarning: boolean;
  syncWarningTitle?: string;
}

function getOperatingModeVariant(
  operatingMode: AcOperatingMode | null,
): "ok" | "muted" | "warn" {
  if (operatingMode === "auto") return "ok";
  if (operatingMode === "away") return "ok";
  if (operatingMode === "manual") return "muted";
  return "warn";
}

export function AcStatusBadges({
  data,
  acState,
  showSyncWarning,
  syncWarningTitle = "mode·power 정합성 확인 중입니다.",
}: AcStatusBadgesProps) {
  const transition = getAcAutoTransitionBadge(data.ac_auto_state);
  const view = resolveAcStateView(data, acState);
  const runningBadge = getAcRunningBadge(
    view.runningFields,
    data.ac_estimated_running,
  );
  const modeText = getAcModeDisplayText({
    mode: view.mode,
    power: view.power,
    lastRunMode: view.lastRunMode,
    operatingMode: view.operatingMode,
    acAutoState: data.ac_auto_state,
    plugEstimatedRunning: data.ac_estimated_running,
  });

  return (
    <div className={shared.badgeRow}>
      <Badge variant={getOperatingModeVariant(view.operatingMode)}>
        {getAcOperatingModeLabel(view.operatingMode)}
      </Badge>
      <Badge variant="muted">{modeText}</Badge>
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
