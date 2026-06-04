import type { AcStateResponse, StatusResponse } from "@/api/types";
import shared from "@/components/status/statusPage.module.css";
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
  const mode = acState?.mode ?? data.ac_mode ?? "off";
  const awayEnabled = acState?.away_enabled ?? data.ac_away_enabled ?? false;

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
          가동 표시는 /ac/state(power·running_source) 우선. 외출모드가 켜지면 HA에서
          외출 정책이 자동제어보다 우선합니다.
        </p>
        <AcPolicyDetails />
        <ModeHelp mode={mode} awayEnabled={awayEnabled} />
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
  mode,
  awayEnabled,
}: {
  mode: string;
  awayEnabled: boolean;
}) {
  if (awayEnabled) {
    return (
      <div className={styles.modeHelp}>
        <p className={styles.modeHelpTitle}>외출모드</p>
        <p className={shared.meta}>
          실내 28°C 이상 또는 (25°C 이상·습도 68% 이상) 20분 유지 시 ON, 27°C
          미만·습도 58% 미만 시 OFF
        </p>
      </div>
    );
  }

  if (mode === "cool") {
    return (
      <div className={styles.modeHelp}>
        <p className={styles.modeHelpTitle}>냉방(cool)</p>
        <p className={shared.meta}>
          일반 냉방. 29°C 근처에서는 cool 선택이 필요합니다.
        </p>
      </div>
    );
  }

  if (mode === "dry") {
    return (
      <div className={styles.modeHelp}>
        <p className={styles.modeHelpTitle}>제습(dry)</p>
        <p className={shared.meta}>
          저전력 IR 가동. 콘센트 전력이 낮아도 가동 중(저전력)으로 표시될 수
          있습니다.
        </p>
      </div>
    );
  }

  if (mode === "auto") {
    return (
      <div className={styles.modeHelp}>
        <p className={styles.modeHelpTitle}>자동(auto)</p>
        <p className={shared.meta}>
          HA가 cool/dry를 선택합니다. 가동 중에는 마지막 실행 모드(last_run_mode)를
          표시합니다.
        </p>
      </div>
    );
  }

  return null;
}
