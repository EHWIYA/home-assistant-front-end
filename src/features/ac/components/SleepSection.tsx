import { Card } from "@/components/Card";
import styles from "./SleepSection.module.css";

const TARGET_MIN = 24;
const TARGET_MAX = 27;

export function SleepSection() {
  return (
    <Card title="수면 모드">
      <p className={styles.lead}>v1 UI 골격 — HA·설정 API는 2단계 연동</p>
      <div className={styles.range}>
        <span className={styles.temp}>{TARGET_MIN}°C</span>
        <span className={styles.dash}>—</span>
        <span className={styles.temp}>{TARGET_MAX}°C</span>
      </div>
      <p className={styles.note}>목표 온도 구간 (자동 저장 예정)</p>
    </Card>
  );
}
