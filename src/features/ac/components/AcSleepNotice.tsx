import styles from "./AcSleepNotice.module.css";

export function AcSleepNotice() {
  return (
    <p className={styles.notice} role="note">
      <strong>수면 모드</strong> — 목표 24–27°C (HA·설정 API 연동 예정, v1 UI
      골격)
    </p>
  );
}
