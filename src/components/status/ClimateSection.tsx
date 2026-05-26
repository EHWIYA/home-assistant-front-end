import { Card } from "@/components/Card";
import type { IndoorClimate, WeatherOutdoor } from "@/api/types";
import styles from "./ClimateSection.module.css";

interface ClimateSectionProps {
  indoor: IndoorClimate | null;
  weatherOutdoor: WeatherOutdoor | null;
  /** true면 실내·외기를 한 카드에 2열로 (에어컨 탭) */
  combined?: boolean;
}

export function ClimateSection({
  indoor,
  weatherOutdoor,
  combined = false,
}: ClimateSectionProps) {
  if (combined) {
    return (
      <Card title="환경">
        <div className={styles.grid}>
          <div>
            <p className={styles.label}>실내</p>
            {indoor ? (
              <p className={styles.value}>
                {indoor.temperature}°C · 습도 {indoor.humidity}%
              </p>
            ) : (
              <p className={styles.unavailable}>
                센서 미연동 (Broadlink 연동 후 표시)
              </p>
            )}
          </div>
          <div>
            <p className={styles.label}>외기</p>
            {weatherOutdoor ? (
              <p className={styles.value}>
                {weatherOutdoor.temperature}°C · 습도{" "}
                {weatherOutdoor.humidity}%
              </p>
            ) : (
              <p className={styles.unavailable}>데이터 없음</p>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card title="실내">
        {indoor ? (
          <p className={styles.value}>
            {indoor.temperature}°C · 습도 {indoor.humidity}%
          </p>
        ) : (
          <p className={styles.unavailable}>
            실내 온습도 센서 미연동 (Broadlink 연동 후 표시)
          </p>
        )}
      </Card>
      {weatherOutdoor ? (
        <Card title="외기">
          <p className={styles.value}>
            {weatherOutdoor.temperature}°C · 습도 {weatherOutdoor.humidity}%
          </p>
        </Card>
      ) : null}
    </>
  );
}
