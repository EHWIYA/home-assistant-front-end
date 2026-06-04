import styles from "./ZoneProgressBar.module.css";

interface ZoneProgressBarProps {
  value: number;
  fillColor: string;
  zoneStart?: number;
  zoneWidth?: number;
  label?: string;
  valueLabel?: string;
}

export function ZoneProgressBar({
  value,
  fillColor,
  zoneStart = 0.4,
  zoneWidth = 0.3,
  label = "습도",
  valueLabel,
}: ZoneProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value));

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {valueLabel ? (
          <span className={styles.valueLabel}>{valueLabel}</span>
        ) : null}
      </div>
      <div className={styles.track}>
        <span
          className={styles.zone}
          style={{
            left: `${zoneStart * 100}%`,
            width: `${zoneWidth * 100}%`,
          }}
          aria-hidden
        />
        <span
          className={styles.fill}
          style={{
            width: `${clamped * 100}%`,
            backgroundColor: fillColor,
          }}
          aria-hidden
        />
      </div>
    </div>
  );
}
