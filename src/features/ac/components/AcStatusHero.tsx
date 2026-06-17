import snowSvg from "cupertino-icons-svg/svg/snow.svg?raw";
import type { CSSProperties } from "react";
import type { AcStateResponse, StatusResponse, WeatherOutdoor } from "@/api/types";
import type { IndoorClimate } from "@/api/types";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { MiniPowerBar } from "@/components/viz/MiniPowerBar";
import { getAcModeDisplayText } from "@/utils/acMode";
import {
  deriveAcOperatingMode,
  getAcOperatingModeLabel,
} from "@/utils/acOperatingMode";
import { getAcRunningBadge } from "@/utils/acRunning";
import { formatTemperatureHumidity } from "@/utils/climate";
import { formatPowerW } from "@/utils/power";
import {
  getAcHomePrimaryStatus,
  type HomeStatusTone,
} from "@/features/home/utils/homeStatus";
import { HOME_DOMAIN_THEME, normalizePowerW } from "@/features/home/utils/homeDomainTheme";
import styles from "./AcStatusHero.module.css";

const TONE_DOT: Record<HomeStatusTone, string> = {
  active: HOME_DOMAIN_THEME.ac.accent,
  idle: "#6b7280",
  warn: "#f0ad4e",
  danger: "#e57373",
};

interface AcStatusHeroProps {
  data: StatusResponse;
  acState: AcStateResponse | undefined;
  showSyncWarning: boolean;
  isSettingMismatch?: boolean;
  syncWarningTitle: string;
  onReapplyAuto?: () => void;
  reapplyAutoPending?: boolean;
}

export function AcStatusHero({
  data,
  acState,
  showSyncWarning,
  isSettingMismatch = false,
  syncWarningTitle,
  onReapplyAuto,
  reapplyAutoPending = false,
}: AcStatusHeroProps) {
  const theme = HOME_DOMAIN_THEME.ac;
  const primary = getAcHomePrimaryStatus(data, acState);
  const mode = acState?.mode ?? data.ac_mode ?? "off";
  const operatingMode = deriveAcOperatingMode(
    acState?.operating_mode ?? data.ac_operating_mode,
    acState?.auto_enabled ?? data.ac_auto_enabled,
    acState?.away_enabled ?? data.ac_away_enabled,
  );
  const modeText = getAcModeDisplayText({
    mode,
    power: acState?.power,
    lastRunMode: acState?.last_run_mode ?? data.ac_last_run_mode ?? null,
    operatingMode,
    acAutoState: data.ac_auto_state,
  });
  const runningBadge = getAcRunningBadge(acState, data.ac_estimated_running);
  const dotColor =
    primary.tone === "active" ? theme.accent : TONE_DOT[primary.tone];

  return (
    <section
      className={styles.card}
      style={{ "--ac-accent": theme.accent } as CSSProperties}
      aria-label="에어컨 상태"
    >
      <header className={styles.header}>
        <span className={styles.iconPill}>
          <CupertinoIcon svg={snowSvg} className="" />
        </span>
        <h2 className={styles.title}>에어컨</h2>
      </header>

      <div className={styles.statusRow}>
        <span
          className={styles.dot}
          style={{
            backgroundColor: dotColor,
            boxShadow:
              primary.tone === "active"
                ? `0 0 0 2px ${theme.accentGlow}`
                : undefined,
          }}
          aria-hidden
        />
        <div>
          <p className={styles.statusLabel}>{primary.label}</p>
          <p className={styles.modeSub}>지금 · {modeText}</p>
        </div>
      </div>

      <div className={styles.pillRow}>
        <span
          className={`${styles.pill} ${
            operatingMode === "auto" || operatingMode === "away"
              ? styles.pillOk
              : operatingMode === "manual"
                ? styles.pillMuted
                : styles.pillWarn
          }`.trim()}
        >
          {getAcOperatingModeLabel(operatingMode)}
        </span>
        {runningBadge ? (
          <span
            className={`${styles.pill} ${
              runningBadge.variant === "ok" ? styles.pillOk : styles.pillWarn
            }`.trim()}
            title={runningBadge.title}
          >
            {runningBadge.label}
          </span>
        ) : null}
      </div>

      <div className={styles.powerSection}>
        <MiniPowerBar
          value={normalizePowerW(data.plug.power_w)}
          color={theme.accent}
          label={`플러그 ${formatPowerW(data.plug.power_w)}`}
        />
      </div>

      <ClimateGrid indoor={data.indoor} weatherOutdoor={data.weather_outdoor} />

      {showSyncWarning ? (
        isSettingMismatch && onReapplyAuto ? (
          <div className={styles.syncBannerRow} title={syncWarningTitle}>
            <p className={styles.syncBannerText}>
              설정 불일치 — 자동 모드가 HA에서 꺼져 있어요.
            </p>
            <button
              type="button"
              className={styles.syncBannerBtn}
              disabled={reapplyAutoPending}
              onClick={onReapplyAuto}
            >
              {reapplyAutoPending ? "적용 중…" : "자동 모드 다시 적용"}
            </button>
          </div>
        ) : (
          <p className={styles.syncBanner} title={syncWarningTitle}>
            장치 상태 동기화 중 — 잠시 후 다시 확인해 주세요.
          </p>
        )
      ) : null}
    </section>
  );
}

function ClimateGrid({
  indoor,
  weatherOutdoor,
}: {
  indoor: IndoorClimate | null;
  weatherOutdoor: WeatherOutdoor | null;
}) {
  return (
    <div className={styles.climateGrid}>
      <div className={styles.climateCell}>
        <p className={styles.climateLabel}>실내</p>
        {indoor ? (
          <p className={styles.climateValue}>
            {formatTemperatureHumidity(indoor.temperature, indoor.humidity)}
          </p>
        ) : (
          <p className={styles.climateUnavailable}>센서 미연동</p>
        )}
        <p className={styles.climateHint}>Broadlink 센서</p>
      </div>
      <div className={styles.climateCell}>
        <p className={styles.climateLabel}>실외기/외기</p>
        {weatherOutdoor ? (
          <>
            <p className={styles.climateValue}>
              {formatTemperatureHumidity(
                weatherOutdoor.temperature,
                weatherOutdoor.humidity,
              )}
            </p>
            {weatherOutdoor.condition ? (
              <p className={styles.climateHint}>{weatherOutdoor.condition}</p>
            ) : (
              <p className={styles.climateHint}>HA forecast_jib · 기상청 아님</p>
            )}
          </>
        ) : (
          <p className={styles.climateUnavailable}>데이터 없음</p>
        )}
      </div>
    </div>
  );
}
