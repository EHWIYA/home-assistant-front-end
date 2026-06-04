import styles from "./PowerLevelBars.module.css";

interface PowerLevelBarsProps {
  heights: number[];
  color: string;
  label?: string;
}

/** 현재 전력 레벨 시각화 (5칸 bar — 시계열 API 연동 전 레벨 표시) */
export function PowerLevelBars({ heights, color, label }: PowerLevelBarsProps) {
  return (
    <div className={styles.wrap} aria-hidden={!label}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <div className={styles.bars}>
        {heights.map((height, index) => (
          <span
            key={index}
            className={styles.bar}
            style={{
              height: `${height * 100}%`,
              backgroundColor: color,
              opacity:
                heights.length <= 1
                  ? 1
                  : 0.35 + (index / (heights.length - 1)) * 0.65,
            }}
          />
        ))}
      </div>
    </div>
  );
}
