import type { IndoorClimate } from "@/api/types";
import { formatLocalWeatherLine } from "@/api/weather";
import { ArcGauge } from "@/components/viz/ArcGauge";
import { ZoneProgressBar } from "@/components/viz/ZoneProgressBar";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { LOCAL_WEATHER_SHORT_LABEL } from "@/config/location";
import { useLocalWeather } from "@/hooks/useLocalWeather";
import { formatClimateValue } from "@/utils/climate";
import {
  getHumidityBarColor,
  getHumidityZoneLeft,
  getHumidityZoneWidth,
  getIndoorComfort,
  getTemperatureArcColor,
  normalizeHumidity,
  normalizeTemperature,
} from "@/utils/climateComfort";
import { getLocalWeatherIconSvg } from "@/utils/weatherIcon";
import styles from "./HomeClimateHero.module.css";

interface HomeClimateHeroProps {
  indoor: IndoorClimate | null;
}

export function HomeClimateHero({ indoor }: HomeClimateHeroProps) {
  const weatherQuery = useLocalWeather();
  const comfort = indoor ? getIndoorComfort(indoor) : null;
  const weather = weatherQuery.data;

  return (
    <section className={styles.hero} aria-label="실내 환경">
      <div className={styles.topRow}>
        <p className={styles.label}>실내 환경</p>
        {comfort ? (
          <span
            className={styles.comfortBadge}
            style={{
              color: comfort.color,
              backgroundColor: comfort.background,
            }}
          >
            {comfort.label}
          </span>
        ) : null}
      </div>

      {indoor ? (
        <>
          <div className={styles.body}>
            <div className={styles.readings}>
              <p className={styles.temperature}>
                {formatClimateValue(indoor.temperature)}°C
              </p>
              <p className={styles.humidityText}>
                습도 {formatClimateValue(indoor.humidity)}%
              </p>
            </div>
            <div className={styles.gaugeWrap}>
              <ArcGauge
                value={normalizeTemperature(indoor.temperature)}
                color={getTemperatureArcColor(indoor.temperature)}
                label={formatClimateValue(indoor.temperature)}
              />
            </div>
          </div>
          <ZoneProgressBar
            value={normalizeHumidity(indoor.humidity)}
            fillColor={getHumidityBarColor(indoor.humidity)}
            zoneStart={getHumidityZoneLeft()}
            zoneWidth={getHumidityZoneWidth()}
            valueLabel={`${formatClimateValue(indoor.humidity)}%`}
          />
        </>
      ) : (
        <p className={styles.unavailable}>센서 미연동</p>
      )}

      <LocalWeatherRow
        loading={weatherQuery.isLoading}
        error={weatherQuery.isError}
        weather={weather}
      />
    </section>
  );
}

function LocalWeatherRow({
  loading,
  error,
  weather,
}: {
  loading: boolean;
  error: boolean;
  weather: ReturnType<typeof useLocalWeather>["data"];
}) {
  const label = weather?.location_short_label ?? LOCAL_WEATHER_SHORT_LABEL;

  if (loading && !weather) {
    return (
      <p className={styles.outdoorMuted}>{label} 날씨 불러오는 중…</p>
    );
  }

  if (error || !weather) {
    return (
      <p className={styles.outdoorMuted}>
        {label} 날씨를 불러오지 못했습니다
      </p>
    );
  }

  return (
    <div className={styles.outdoor}>
      <CupertinoIcon
        svg={getLocalWeatherIconSvg(weather)}
        className={styles.weatherIcon}
      />
      <p className={styles.outdoorText}>{formatLocalWeatherLine(weather)}</p>
    </div>
  );
}
