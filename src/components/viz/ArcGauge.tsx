import styles from "./ArcGauge.module.css";

interface ArcGaugeProps {
  value: number;
  color: string;
  label: string;
  unit?: string;
  size?: number;
}

export function ArcGauge({
  value,
  color,
  label,
  unit = "°C",
  size = 96,
}: ArcGaugeProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);
  const center = size / 2;

  return (
    <div
      className={styles.wrap}
      style={{ width: size, height: size / 2 + strokeWidth }}
      aria-hidden
    >
      <svg
        className={styles.svg}
        width={size}
        height={size / 2 + strokeWidth}
        viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}
      >
        <path
          className={styles.track}
          d={describeArc(center, center, radius, 180, 0)}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          className={styles.fill}
          d={describeArc(center, center, radius, 180, 0)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className={styles.center}>
        <span className={styles.value}>{label}</span>
        <span className={styles.unit}>{unit}</span>
      </div>
    </div>
  );
}

function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(x, y, radius, startAngle);
  const end = polarToCartesian(x, y, radius, endAngle);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleDeg: number,
) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleRad),
    y: centerY - radius * Math.sin(angleRad),
  };
}
