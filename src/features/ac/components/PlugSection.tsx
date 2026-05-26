import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { OnOffAction, PlugStatus } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import shared from "@/components/status/statusPage.module.css";
import { formatPowerW } from "@/utils/power";
import styles from "./PlugSection.module.css";

interface PlugSectionProps {
  plug: PlugStatus;
  mutation: UseMutationResult<unknown, Error, OnOffAction, unknown>;
  /** 홈: 토글만 간략 / 에어컨 탭: 전력·누적 포함 */
  variant?: "full" | "compact";
}

export function PlugSection({
  plug,
  mutation,
  variant = "full",
}: PlugSectionProps) {
  const plugOn = plug.switch === "on";
  const nextAction: OnOffAction = plugOn ? "off" : "on";

  if (variant === "compact") {
    return (
      <div className={styles.compact}>
        <span className={styles.compactState}>
          플러그 <strong>{plugOn ? "ON" : "OFF"}</strong>
          {" · "}
          {formatPowerW(plug.power_w)}
        </span>
        <Button
          variant={plugOn ? "danger" : "primary"}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(nextAction)}
        >
          {mutation.isPending ? "…" : plugOn ? "끄기" : "켜기"}
        </Button>
      </div>
    );
  }

  return (
    <Card title="스마트 플러그 (에어컨 전원)">
      <p className={styles.powerValue}>{formatPowerW(plug.power_w)}</p>
      <p className={shared.meta}>
        누적 {plug.energy_kwh.toFixed(2)} kWh · 현재{" "}
        <strong>{plugOn ? "ON" : "OFF"}</strong>
      </p>
      <Button
        fullWidth
        variant={plugOn ? "danger" : "primary"}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(nextAction)}
      >
        {mutation.isPending
          ? "처리 중…"
          : plugOn
            ? "플러그 끄기"
            : "플러그 켜기"}
      </Button>
      {mutation.isError ? (
        <p className={shared.errorDetail}>토글 실패 — 다시 시도해 주세요.</p>
      ) : null}
    </Card>
  );
}
