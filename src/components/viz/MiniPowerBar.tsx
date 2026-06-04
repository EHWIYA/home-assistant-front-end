import styles from "./MiniPowerBar.module.css";

interface MiniPowerBarProps {
  value: number;
  color: string;
  label?: string;
}

export function MiniPowerBar({ value, color, label }: MiniPowerBarProps) {
  const clamped = Math.min(1, Math.max(0, value));

  return (
    <div className={styles.wrap}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <div className={styles.track} aria-hidden>
        <span
          className={styles.fill}
          style={{
            width: `${Math.max(clamped * 100, clamped > 0 ? 4 : 0)}%`,
            backgroundColor: color,
            boxShadow: clamped > 0.5 ? `0 0 8px ${color}55` : undefined,
          }}
        />
      </div>
    </div>
  );
}
