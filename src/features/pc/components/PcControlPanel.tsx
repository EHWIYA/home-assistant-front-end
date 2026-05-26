import { Card } from "@/components/Card";
import { Badge } from "@/components/status/Badge";
import { OnOffActionButtons } from "@/components/status/OnOffActionButtons";
import type { PcStatus } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import type { OnOffAction } from "@/api/types";
import shared from "@/components/status/statusPage.module.css";
import { formatEstimatedCostWon } from "@/utils/electricity";
import { formatPowerW } from "@/utils/power";
import {
  getPcStatusLabel,
  isPcControllable,
  requestPcToggle,
} from "@/utils/pcStatus";
import styles from "./PcControlPanel.module.css";

interface PcControlPanelProps {
  pc: PcStatus;
  mutation: UseMutationResult<unknown, Error, OnOffAction, unknown>;
}

export function PcControlPanel({ pc, mutation }: PcControlPanelProps) {
  const pcOn = pc.switch === "on";
  const controllable = isPcControllable(pc);
  const statusClass =
    pc.switch === "unavailable" || pc.switch === "unknown"
      ? styles.warn
      : pc.estimated_running
        ? styles.on
        : styles.off;

  return (
    <Card title="PC (HWIYA-PC)">
      <p className={`${styles.status} ${statusClass}`}>
        {getPcStatusLabel(pc)}
      </p>
      <div className={shared.badgeRow}>
        <Badge variant={pc.online ? "ok" : "warn"}>
          {pc.online ? "온라인" : "오프라인"}
        </Badge>
        {pc.overload ? <Badge variant="danger">과부하</Badge> : null}
        {pc.wifi_signal_level > 0 ? (
          <Badge variant="muted">Wi‑Fi {pc.wifi_signal_level}</Badge>
        ) : null}
      </div>
      <p className={shared.meta}>
        {formatPowerW(pc.power_w)}
        {" · "}오늘 {pc.energy_today_kwh.toFixed(2)} kWh
        {pc.estimated_cost_today_won != null
          ? ` (${formatEstimatedCostWon(pc.estimated_cost_today_won)})`
          : null}
        {" · "}이번 달 {pc.energy_month_kwh.toFixed(2)} kWh
        {pc.estimated_cost_month_won != null
          ? ` (${formatEstimatedCostWon(pc.estimated_cost_month_won)})`
          : null}
      </p>
      {pc.switch === "unavailable" ? (
        <p className={shared.blockedHint}>
          Tapo 연동이 불가합니다. HA·API 상태를 확인해 주세요.
        </p>
      ) : null}
      {!pc.online ? (
        <p className={shared.blockedHint}>
          기기가 오프라인입니다. 제어할 수 없습니다.
        </p>
      ) : null}
      <OnOffActionButtons
        disabled={!controllable}
        isPending={mutation.isPending}
        pendingAction={mutation.variables}
        onOn={() => requestPcToggle("on", mutation.mutate)}
        onOff={() => requestPcToggle("off", mutation.mutate)}
        error={mutation.isError}
      />
      <p className={shared.meta}>
        콘센트: <strong>{pcOn ? "ON" : "OFF"}</strong>
        {pc.estimated_running ? " · 전력 50W 이상" : null}
      </p>
    </Card>
  );
}
