import { Badge } from "@/components/status/Badge";
import type { StatusResponse } from "@/api/types";
import {
  getAcAutoEnabledLabel,
  getAcAutoTransitionBadge,
} from "@/utils/acAuto";
import { getAcAutoEnabledVariant } from "@/utils/acAutoBadge";
import shared from "@/components/status/statusPage.module.css";

interface AcStatusBadgesProps {
  data: Pick<
    StatusResponse,
    "ac_auto_enabled" | "ac_auto_state" | "ac_estimated_running"
  >;
}

export function AcStatusBadges({ data }: AcStatusBadgesProps) {
  const transition = getAcAutoTransitionBadge(data.ac_auto_state);

  return (
    <div className={shared.badgeRow}>
      <Badge
        variant={getAcAutoEnabledVariant(data.ac_auto_enabled)}
        title="HA 자동 ON/OFF 마스터 (읽기 전용, 토글 API 2차)"
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
      {data.ac_estimated_running ? (
        <Badge
          variant="ok"
          title="스마트플러그 전력 50W 초과 추정 — 자동 on/off 이력과 별도"
        >
          가동 중(추정)
        </Badge>
      ) : null}
    </div>
  );
}
