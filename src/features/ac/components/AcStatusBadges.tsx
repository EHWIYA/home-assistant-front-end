import { Badge } from "@/components/status/Badge";
import type { AcOperatingMode, AcStateResponse, StatusResponse } from "@/api/types";
import { getAcAutoTransitionBadge } from "@/utils/acAuto";
import { getAcModeDisplayText } from "@/utils/acMode";
import {
  deriveAcOperatingMode,
  getAcOperatingModeLabel,
} from "@/utils/acOperatingMode";
import { getAcRunningBadge } from "@/utils/acRunning";
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
  const runningBadge = getAcRunningBadge(acState, data.ac_estimated_running);
  const operatingMode = deriveAcOperatingMode(
    acState?.operating_mode ?? data.ac_operating_mode,
    acState?.auto_enabled ?? data.ac_auto_enabled,
    acState?.away_enabled ?? data.ac_away_enabled,
  );
  const mode = acState?.mode ?? data.ac_mode ?? "off";
  const modeText = getAcModeDisplayText({
    mode,
    power: acState?.power,
    lastRunMode: acState?.last_run_mode ?? data.ac_last_run_mode ?? null,
    operatingMode,
    acAutoState: data.ac_auto_state,
  });

  return (
    <div className={shared.badgeRow}>
      <Badge variant={getOperatingModeVariant(operatingMode)}>
        {getAcOperatingModeLabel(operatingMode)}
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
