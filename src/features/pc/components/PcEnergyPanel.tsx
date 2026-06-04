import type { CSSProperties } from "react";
import type { PcStatus } from "@/api/types";
import { HOME_DOMAIN_THEME } from "@/features/home/utils/homeDomainTheme";
import { formatEstimatedCostWon } from "@/utils/electricity";
import styles from "./PcEnergyPanel.module.css";

const theme = HOME_DOMAIN_THEME.pc;

interface PcEnergyPanelProps {
  pc: PcStatus;
}

export function PcEnergyPanel({ pc }: PcEnergyPanelProps) {
  return (
    <section
      className={styles.card}
      style={{ "--pc-accent": theme.accent } as CSSProperties}
      aria-label="PC 전력 사용량"
    >
      <h2 className={styles.title}>전력·요금</h2>
      <div className={styles.grid}>
        <div className={styles.cell}>
          <p className={styles.label}>오늘</p>
          <p className={styles.value}>{pc.energy_today_kwh.toFixed(2)} kWh</p>
          {pc.estimated_cost_today_won != null ? (
            <p className={styles.hint}>
              {formatEstimatedCostWon(pc.estimated_cost_today_won)}
            </p>
          ) : (
            <p className={styles.hint}>요금 미산출</p>
          )}
        </div>
        <div className={styles.cell}>
          <p className={styles.label}>이번 달</p>
          <p className={styles.value}>{pc.energy_month_kwh.toFixed(2)} kWh</p>
          {pc.estimated_cost_month_won != null ? (
            <p className={styles.hint}>
              {formatEstimatedCostWon(pc.estimated_cost_month_won)}
            </p>
          ) : (
            <p className={styles.hint}>요금 미산출</p>
          )}
        </div>
      </div>
    </section>
  );
}
