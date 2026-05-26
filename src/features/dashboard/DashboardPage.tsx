import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { PcStatus } from "@/api/types";
import { useAcControl, usePcToggle, usePlugToggle, useStatus } from "@/hooks/useStatus";
import {
  getAcAutoEnabledLabel,
  getAcAutoTransitionBadge,
} from "@/utils/acAuto";
import { formatUpdatedAt } from "@/utils/date";
import styles from "./DashboardPage.module.css";

const PC_OFF_CONFIRM =
  "콘센트 전원을 끕니다. PC가 안전하게 종료되지 않을 수 있습니다.";

function getPcStatusLabel(pc: PcStatus): string {
  if (pc.switch === "unavailable") return "제어 불가";
  if (pc.switch === "unknown") return "상태 알 수 없음";
  if (pc.switch === "off") return "콘센트 OFF";
  if (pc.estimated_running) return "PC 동작 추정";
  return "대기/꺼짐 (콘센트 ON)";
}

function isPcControllable(pc: PcStatus): boolean {
  return (
    pc.online &&
    pc.switch !== "unavailable" &&
    pc.switch !== "unknown"
  );
}

function formatPower(w: number | null): string {
  if (w == null) return "—";
  return `${Math.round(w)} W`;
}

function getAcAutoEnabledBadgeClass(
  enabled: boolean | null | undefined,
): string {
  if (enabled === true) return styles.badgeOk;
  if (enabled === false) return styles.badgeMuted;
  return styles.badgeWarn;
}

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useStatus();
  const plugMutation = usePlugToggle();
  const acMutation = useAcControl();
  const pcMutation = usePcToggle();

  if (isLoading) {
    return <p className={styles.message}>상태 불러오는 중…</p>;
  }

  if (isError || !data) {
    return (
      <div className={styles.offline}>
        <p className={styles.message}>연결할 수 없습니다</p>
        <p className={styles.hint}>
          Tailscale·API 주소를 확인하세요. 401이면 GitHub Secret{" "}
          <code>VITE_API_KEY</code> 후 재배포가 필요합니다.
        </p>
        {error instanceof Error ? (
          <p className={styles.errorDetail}>{error.message}</p>
        ) : null}
        <Button onClick={() => void refetch()}>다시 시도</Button>
      </div>
    );
  }

  const plugOn = data.plug.switch === "on";
  const nextAction = plugOn ? "off" : "on";
  const acControlEnabled = plugOn;
  const acAutoTransition = getAcAutoTransitionBadge(data.ac_auto_state);

  return (
    <div className={styles.page}>
      <Card title="전력">
        <p className={styles.powerValue}>{formatPower(data.plug.power_w)}</p>
        <p className={styles.meta}>
          누적 {data.plug.energy_kwh.toFixed(2)} kWh
          {isFetching ? " · 갱신 중…" : null}
        </p>
      </Card>

      <Card title="에어컨">
        <div className={styles.acBadges}>
          <span
            className={getAcAutoEnabledBadgeClass(data.ac_auto_enabled)}
            title="HA 자동 ON/OFF 마스터 (읽기 전용, 토글 API 2차)"
          >
            {getAcAutoEnabledLabel(data.ac_auto_enabled)}
          </span>
          {acAutoTransition.kind === "transition" ? (
            <span
              className={styles.badgeMuted}
              title={acAutoTransition.title}
            >
              {acAutoTransition.label}
            </span>
          ) : (
            <span className={styles.badgeMuted}>자동 기록 없음</span>
          )}
          {data.ac_estimated_running ? (
            <span
              className={styles.badgeOk}
              title="스마트플러그 전력 50W 초과 추정 — 자동 on/off 이력과 별도"
            >
              가동 중(추정)
            </span>
          ) : null}
        </div>
        <p className={styles.meta}>
          가동 추정은 플러그 전력 기준 (IR·자동 전환 이력과 무관)
        </p>
        <details className={styles.acPolicy}>
          <summary>자동제어 조건</summary>
          <ul className={styles.acPolicyList}>
            <li>자동제어 꺼짐 → 자동 ON/OFF 중단</li>
            <li>집 비움 → 자동 ON 불가, OFF는 조건 충족 시 가능</li>
            <li>
              켜기: 27°C 이상 5분 또는 (24°C 이상·습도 70% 이상 10분)
            </li>
            <li>
              끄기: 25°C 미만·습도 55% 미만(각 10분 유지, 최소 가동 25분)
            </li>
          </ul>
        </details>
        {!acControlEnabled ? (
          <p className={styles.acBlockedHint}>
            플러그가 꺼져 있어 에어컨을 제어할 수 없습니다. 먼저 플러그를
            켜 주세요.
          </p>
        ) : null}
        <div className={styles.acActions}>
          <Button
            fullWidth
            variant="primary"
            disabled={!acControlEnabled || acMutation.isPending}
            onClick={() => acMutation.mutate("on")}
          >
            {acMutation.isPending && acMutation.variables === "on"
              ? "처리 중…"
              : "켜기"}
          </Button>
          <Button
            fullWidth
            variant="danger"
            disabled={!acControlEnabled || acMutation.isPending}
            onClick={() => acMutation.mutate("off")}
          >
            {acMutation.isPending && acMutation.variables === "off"
              ? "처리 중…"
              : "끄기"}
          </Button>
        </div>
        {acMutation.isError ? (
          <p className={styles.errorDetail}>제어 실패 — 다시 시도해 주세요.</p>
        ) : null}
      </Card>

      {data.pc ? (
        <PcCard
          pc={data.pc}
          isFetching={isFetching}
          mutation={pcMutation}
        />
      ) : null}

      <Card title="실내">
        {data.indoor ? (
          <>
            <p className={styles.weather}>
              {data.indoor.temperature}°C · 습도 {data.indoor.humidity}%
            </p>
            {isFetching ? (
              <p className={styles.meta}>갱신 중…</p>
            ) : null}
          </>
        ) : (
          <p className={styles.meta}>
            실내 온습도 센서 미연동 (Broadlink 연동 후 표시)
          </p>
        )}
      </Card>

      {data.weather_outdoor ? (
        <Card title="외기">
          <p className={styles.weather}>
            {data.weather_outdoor.temperature}°C · 습도{" "}
            {data.weather_outdoor.humidity}%
          </p>
        </Card>
      ) : null}

      <Card title="플러그">
        <p className={styles.plugState}>
          현재: <strong>{plugOn ? "ON" : "OFF"}</strong>
        </p>
        <Button
          fullWidth
          variant={plugOn ? "danger" : "primary"}
          disabled={plugMutation.isPending}
          onClick={() => plugMutation.mutate(nextAction)}
        >
          {plugMutation.isPending
            ? "처리 중…"
            : plugOn
              ? "플러그 끄기"
              : "플러그 켜기"}
        </Button>
        {plugMutation.isError ? (
          <p className={styles.errorDetail}>토글 실패 — 다시 시도해 주세요.</p>
        ) : null}
      </Card>

      <p className={styles.updated}>
        갱신: {formatUpdatedAt(data.updated_at)}
        {data.person.state ? ` · ${data.person.state}` : ""}
      </p>
    </div>
  );
}

interface PcCardProps {
  pc: PcStatus;
  isFetching: boolean;
  mutation: ReturnType<typeof usePcToggle>;
}

function PcCard({ pc, isFetching, mutation }: PcCardProps) {
  const pcOn = pc.switch === "on";
  const controllable = isPcControllable(pc);
  const statusClass =
    pc.switch === "unavailable" || pc.switch === "unknown"
      ? styles.pcWarn
      : pc.estimated_running
        ? styles.pcOn
        : styles.pcOff;

  const requestPcAction = (action: "on" | "off") => {
    if (action === "off") {
      if (!window.confirm(PC_OFF_CONFIRM)) return;
    }
    mutation.mutate(action);
  };

  return (
    <Card title="PC (HWIYA-PC)">
      <p className={`${styles.pcStatus} ${statusClass}`}>
        {getPcStatusLabel(pc)}
      </p>
      <div className={styles.pcBadges}>
        <span className={pc.online ? styles.badgeOk : styles.badgeWarn}>
          {pc.online ? "온라인" : "오프라인"}
        </span>
        {pc.overload ? (
          <span className={styles.badgeDanger}>과부하</span>
        ) : null}
        {pc.wifi_signal_level > 0 ? (
          <span className={styles.badgeMuted}>
            Wi‑Fi {pc.wifi_signal_level}
          </span>
        ) : null}
      </div>
      <p className={styles.meta}>
        {formatPower(pc.power_w)}
        {" · "}오늘 {pc.energy_today_kwh.toFixed(2)} kWh
        {" · "}이번 달 {pc.energy_month_kwh.toFixed(2)} kWh
        {isFetching ? " · 갱신 중…" : null}
      </p>
      {pc.switch === "unavailable" ? (
        <p className={styles.pcBlockedHint}>
          Tapo 연동이 불가합니다. HA·API 상태를 확인해 주세요.
        </p>
      ) : null}
      {!pc.online ? (
        <p className={styles.pcBlockedHint}>
          기기가 오프라인입니다. 제어할 수 없습니다.
        </p>
      ) : null}
      <div className={styles.pcActions}>
        <Button
          fullWidth
          variant="primary"
          disabled={!controllable || mutation.isPending}
          onClick={() => requestPcAction("on")}
        >
          {mutation.isPending && mutation.variables === "on"
            ? "처리 중…"
            : "켜기"}
        </Button>
        <Button
          fullWidth
          variant="danger"
          disabled={!controllable || mutation.isPending}
          onClick={() => requestPcAction("off")}
        >
          {mutation.isPending && mutation.variables === "off"
            ? "처리 중…"
            : "끄기"}
        </Button>
      </div>
      <p className={styles.meta}>
        콘센트: <strong>{pcOn ? "ON" : "OFF"}</strong>
        {pc.estimated_running ? " · 전력 50W 이상" : null}
      </p>
      {mutation.isError ? (
        <p className={styles.errorDetail}>제어 실패 — 다시 시도해 주세요.</p>
      ) : null}
    </Card>
  );
}
