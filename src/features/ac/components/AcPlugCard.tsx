import { Button } from "@/components/Button";
import type { OnOffAction, PlugStatus } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import { useMutationErrorToast } from "@/hooks/useMutationErrorToast";
import { formatEstimatedCostWon } from "@/utils/electricity";
import { formatPowerW } from "@/utils/power";
import { TOAST_DEVICE, TOAST_GUIDE } from "@/utils/toastMessages";
import styles from "./AcPlugCard.module.css";

interface AcPlugCardProps {
  plug: PlugStatus;
  mutation: UseMutationResult<unknown, Error, OnOffAction, unknown>;
}

export function AcPlugCard({ plug, mutation }: AcPlugCardProps) {
  const plugOn = plug.switch === "on";
  const nextAction: OnOffAction = plugOn ? "off" : "on";

  useMutationErrorToast(
    mutation,
    TOAST_DEVICE.plug,
    TOAST_GUIDE.retry,
    "control",
  );

  return (
    <section className={styles.card} aria-label="스마트 플러그">
      <h2 className={styles.title}>스마트 플러그 (에어컨 전원)</h2>
      <p className={styles.powerValue}>{formatPowerW(plug.power_w)}</p>
      <p className={styles.meta}>
        누적 {plug.energy_kwh.toFixed(2)} kWh
        {plug.estimated_cost_won != null
          ? ` · ${formatEstimatedCostWon(plug.estimated_cost_won)}`
          : null}
        {" · "}현재 <strong>{plugOn ? "ON" : "OFF"}</strong>
      </p>
      <div className={styles.actions}>
        <Button
          fullWidth
          variant={plugOn ? "danger" : "primary"}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(nextAction)}
        >
          {mutation.isPending
            ? "처리 중…"
            : plugOn
              ? "자동제어 끄기 (플러그 OFF)"
              : "자동제어 켜기 (플러그 ON)"}
        </Button>
      </div>
    </section>
  );
}
