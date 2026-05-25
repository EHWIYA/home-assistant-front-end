import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAcControl, usePlugToggle, useStatus } from "@/hooks/useStatus";
import styles from "./DashboardPage.module.css";

function formatPower(w: number | null): string {
  if (w == null) return "—";
  return `${Math.round(w)} W`;
}

function formatUpdatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useStatus();
  const plugMutation = usePlugToggle();
  const acMutation = useAcControl();

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
        <p
          className={`${styles.acStatus} ${
            data.ac_estimated_running ? styles.acOn : styles.acOff
          }`}
        >
          {data.ac_estimated_running ? "가동 추정 중" : "정지 추정"}
        </p>
        <p className={styles.meta}>전력 50W 초과 시 가동으로 추정</p>
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
