import { Card } from "@/components/Card";
import { useStatus } from "@/hooks/useStatus";
import styles from "./SleepPage.module.css";

const TARGET_MIN = 24;
const TARGET_MAX = 27;

export function SleepPage() {
  const { data, isLoading } = useStatus();

  return (
    <div className={styles.page}>
      <p className={styles.lead}>수면 모드 (v1 UI 골격)</p>

      <Card title="목표 온도">
        <div className={styles.range}>
          <span className={styles.temp}>{TARGET_MIN}°C</span>
          <span className={styles.dash}>—</span>
          <span className={styles.temp}>{TARGET_MAX}°C</span>
        </div>
        <p className={styles.note}>
          자동 저장·HA 연동은 2단계에서 iot-api 설정 API와 연결합니다.
        </p>
      </Card>

      <Card title="현재 상태">
        {isLoading ? (
          <p className={styles.note}>불러오는 중…</p>
        ) : data?.indoor ? (
          <p className={styles.indoor}>
            실내 {data.indoor.temperature}°C · 습도 {data.indoor.humidity}%
          </p>
        ) : (
          <p className={styles.note}>
            실내 온습도 센서 미연동 (Broadlink 연동 후 표시)
          </p>
        )}
        {data?.weather_outdoor ? (
          <p className={styles.note}>
            외기 {data.weather_outdoor.temperature}°C
          </p>
        ) : null}
      </Card>
    </div>
  );
}
