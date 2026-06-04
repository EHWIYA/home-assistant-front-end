import type { AcStateResponse, StatusResponse } from "@/api/types";
import { useAcThresholds } from "@/hooks/useStatus";
import shared from "@/components/status/statusPage.module.css";
import { deriveAcOperatingMode } from "@/utils/acOperatingMode";
import { getAcModeDisplayText, isAcPowerOff } from "@/utils/acMode";
import { AcPolicyDetails } from "./AcPolicyDetails";
import { AcStatusBadges } from "./AcStatusBadges";
import styles from "./AcAdvancedPanel.module.css";

interface AcAdvancedPanelProps {
  data: StatusResponse;
  acState: AcStateResponse | undefined;
  showSyncWarning: boolean;
  syncWarningTitle: string;
}

export function AcAdvancedPanel({
  data,
  acState,
  showSyncWarning,
  syncWarningTitle,
}: AcAdvancedPanelProps) {
  const thresholdsQuery = useAcThresholds();
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

  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>상세 · 정책 · 도움말</summary>
      <div className={styles.body}>
        <AcStatusBadges
          data={data}
          acState={acState}
          showSyncWarning={showSyncWarning}
          syncWarningTitle={syncWarningTitle}
        />
        <p className={shared.meta}>
          가동 표시는 /ac/state(power·running_source) 우선. 운전모드는
          manual/auto/away 상호 배타 — GET /ac/thresholds 안내와 HA 판정 v2가
          정본입니다.
        </p>
        <AcPolicyDetails
          thresholds={thresholdsQuery.data}
          loading={thresholdsQuery.isLoading}
        />
        <ModeHelp
          data={data}
          acState={acState}
          operatingMode={operatingMode}
          mode={mode}
          modeText={modeText}
        />
        {showSyncWarning ? (
          <p className={shared.blockedHint}>
            장치 상태 동기화 중입니다. running_source·모드가 맞는지 확인한 뒤
            잠시 후 다시 시도해 주세요.
          </p>
        ) : null}
      </div>
    </details>
  );
}

function ModeHelp({
  data,
  acState,
  operatingMode,
  mode,
  modeText,
}: {
  data: StatusResponse;
  acState: AcStateResponse | undefined;
  operatingMode: ReturnType<typeof deriveAcOperatingMode>;
  mode: string;
  modeText: string;
}) {
  if (isAcPowerOff(acState?.power, data.ac_auto_state)) {
    return null;
  }

  if (operatingMode === "away") {
    return (
      <div className={styles.modeHelp}>
        <p className={styles.modeHelpTitle}>외출</p>
        <p className={shared.meta}>현재 {modeText}</p>
      </div>
    );
  }

  if (operatingMode === "auto" && mode === "cool") {
    return (
      <div className={styles.modeHelp}>
        <p className={styles.modeHelpTitle}>냉방 고정</p>
        <p className={shared.meta}>켜고 끄기는 HA가, 냉방만 고정합니다.</p>
      </div>
    );
  }

  if (operatingMode === "auto") {
    return (
      <div className={styles.modeHelp}>
        <p className={styles.modeHelpTitle}>자동</p>
        <p className={shared.meta}>
          HA가 냉방/제습을 선택합니다. 가동 중에는 last_run_mode를 표시합니다.
        </p>
      </div>
    );
  }

  if (mode === "cool") {
    return (
      <div className={styles.modeHelp}>
        <p className={styles.modeHelpTitle}>냉방</p>
        <p className={shared.meta}>
          일반 냉방. 29°C 근처에서는 냉방 선택이 필요합니다.
        </p>
      </div>
    );
  }

  if (mode === "dry" && acState?.power === "on") {
    return (
      <div className={styles.modeHelp}>
        <p className={styles.modeHelpTitle}>제습</p>
        <p className={shared.meta}>
          저전력으로 돌아갈 수 있습니다. 콘센트 전력이 낮아도 가동 중(저전력)으로
          표시될 수 있습니다.
        </p>
      </div>
    );
  }

  if (mode === "auto") {
    return (
      <div className={styles.modeHelp}>
        <p className={styles.modeHelpTitle}>에어컨 자동</p>
        <p className={shared.meta}>냉방/제습을 번갈아 선택합니다.</p>
      </div>
    );
  }

  return null;
}
