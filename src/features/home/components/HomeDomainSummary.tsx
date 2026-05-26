import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/Card";
import type { PcStatus, StatusResponse } from "@/api/types";
import type { StripStateResponse } from "@/api/types";
import {
  getAcAutoEnabledLabel,
  getAcAutoTransitionBadge,
} from "@/utils/acAuto";
import { formatClimateLine } from "@/utils/climate";
import { formatEstimatedCostWon } from "@/utils/electricity";
import { formatPowerW } from "@/utils/power";
import { getPcStatusLabel } from "@/utils/pcStatus";
import styles from "./HomeDomainSummary.module.css";

interface HomeDomainSummaryProps {
  status: StatusResponse;
  strip: StripStateResponse | null;
  stripLoading: boolean;
}

function formatStripSummary(strip: StripStateResponse | null): string {
  if (!strip) return "—";
  if (!strip.online) return "오프라인";
  const onCount = strip.channels.filter((ch) => ch.on === true).length;
  return `${onCount}/${strip.channels.length} 채널 ON`;
}

export function HomeDomainSummary({
  status,
  strip,
  stripLoading,
}: HomeDomainSummaryProps) {
  const plugOn = status.plug.switch === "on";
  const acTransition = getAcAutoTransitionBadge(status.ac_auto_state);
  const acLine = [
    getAcAutoEnabledLabel(status.ac_auto_enabled),
    acTransition.kind === "transition"
      ? acTransition.label
      : null,
    status.ac_estimated_running ? "가동 추정" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={styles.grid}>
      <SummaryLink to="/ac" title="에어컨">
        <p className={styles.line}>
          플러그 {plugOn ? "ON" : "OFF"} · {formatPowerW(status.plug.power_w)}
        </p>
        {status.plug.estimated_cost_won != null ? (
          <p className={styles.sub}>
            누적 추정 {formatEstimatedCostWon(status.plug.estimated_cost_won)}
          </p>
        ) : null}
        <p className={styles.sub}>{acLine || "에어컨 상태 없음"}</p>
        <p className={styles.sub}>
          {formatClimateLine(status.indoor, status.weather_outdoor)}
        </p>
      </SummaryLink>

      <SummaryLink to="/pc" title="PC">
        {status.pc ? (
          <PcSummaryLine pc={status.pc} />
        ) : (
          <p className={styles.sub}>PC 미연동</p>
        )}
      </SummaryLink>

      <SummaryLink to="/strip" title="멀티탭">
        <p className={styles.line}>
          {stripLoading ? "불러오는 중…" : formatStripSummary(strip)}
        </p>
        <p className={styles.sub}>채널·스케줄 관리</p>
      </SummaryLink>
    </div>
  );
}

function SummaryLink({
  to,
  title,
  children,
}: {
  to: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={styles.link}>
      <Card title={title}>{children}</Card>
    </Link>
  );
}

function PcSummaryLine({ pc }: { pc: PcStatus }) {
  return (
    <>
      <p className={styles.line}>{getPcStatusLabel(pc)}</p>
      <p className={styles.sub}>
        {pc.online ? "온라인" : "오프라인"}
        {" · "}
        {formatPowerW(pc.power_w)}
        {pc.estimated_cost_today_won != null
          ? ` · 오늘 ${formatEstimatedCostWon(pc.estimated_cost_today_won)}`
          : null}
      </p>
    </>
  );
}
