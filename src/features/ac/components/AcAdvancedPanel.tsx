import type { AcMode, AcOperatingMode, AcStateResponse, StatusResponse } from "@/api/types";
import { useAcThresholds } from "@/hooks/useStatus";
import { getAcAutoTransitionBadge } from "@/utils/acAuto";
import {
  isAcRunningUncertain,
  resolveAcRunningConfidence,
} from "@/utils/acFreshness";
import { getAcOperatingModeLabel } from "@/utils/acOperatingMode";
import { getAcModeDisplayText, isAcPowerOff } from "@/utils/acMode";
import { resolveAcStateView } from "@/utils/acStateView";
import {
  formatMutexLineForUser,
  splitMutexLines,
} from "@/utils/acPolicyDisplay";
import { getAcRunningBadge } from "@/utils/acRunning";
import { AcPolicyDetails } from "./AcPolicyDetails";
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
  const view = resolveAcStateView(data, acState);
  const uncertain = isAcRunningUncertain(data, acState);
  const confidence = resolveAcRunningConfidence(data, acState);
  const modeText = getAcModeDisplayText({
    mode: view.mode,
    power: view.power,
    lastRunMode: view.lastRunMode,
    operatingMode: view.operatingMode,
    acAutoState: data.ac_auto_state,
    plugEstimatedRunning: data.ac_estimated_running,
    isUncertain: uncertain,
  });
  const powerOff =
    !uncertain &&
    isAcPowerOff(view.power, {
      acAutoState: data.ac_auto_state,
      plugEstimatedRunning: data.ac_estimated_running,
      statusMode: view.mode,
    });
  const help = getModeHelpCopy(view.operatingMode, view.mode, powerOff);
  const mutexLines = thresholdsQuery.data?.mutex
    ? splitMutexLines(thresholdsQuery.data.mutex)
    : [];

  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>상세 · 정책 · 도움말</summary>
      <div className={styles.body}>
        {showSyncWarning ? (
          <p className={styles.syncWarn} title={syncWarningTitle}>
            설정과 실제 상태가 어긋났습니다. 잠시 후 다시 확인해 주세요.
          </p>
        ) : null}

        <StatusSnapshot
          data={data}
          acState={acState}
          modeText={modeText}
          operatingMode={view.operatingMode}
          uncertain={uncertain}
          confidence={confidence}
        />

        {help ? (
          <details className={styles.fold} open={powerOff}>
            <summary className={styles.foldSummary}>이 모드 안내</summary>
            <div className={styles.foldBody}>
              <p className={styles.helpText}>{help}</p>
            </div>
          </details>
        ) : null}

        <details className={styles.fold}>
          <summary className={styles.foldSummary}>집·외출 자동 조건</summary>
          <div className={styles.foldBody}>
            <AcPolicyDetails
              thresholds={thresholdsQuery.data}
              loading={thresholdsQuery.isLoading}
              error={thresholdsQuery.isError}
            />
          </div>
        </details>

        <details className={styles.fold}>
          <summary className={styles.foldSummary}>자세히</summary>
          <div className={styles.foldBody}>
            {mutexLines.length > 0 ? (
              <ul className={styles.devList}>
                {mutexLines.map((line) => (
                  <li key={line}>{formatMutexLineForUser(line)}</li>
                ))}
              </ul>
            ) : null}
            <ul className={styles.devList}>
              <li>
                전력 센서가 오래됐거나 신뢰도가 낮으면 「꺼짐」을 단정하지 않고
                「확인 중」으로 표시합니다.
              </li>
              <li>가동 여부는 전원·가동 신호와 freshness(신뢰도)를 함께 봅니다.</li>
              <li>조건은 서버·Home Assistant 설정(thresholds v4)과 같습니다.</li>
            </ul>
          </div>
        </details>
      </div>
    </details>
  );
}

function StatusSnapshot({
  data,
  acState,
  modeText,
  operatingMode,
  uncertain,
  confidence,
}: {
  data: StatusResponse;
  acState: AcStateResponse | undefined;
  modeText: string;
  operatingMode: AcOperatingMode | null;
  uncertain: boolean;
  confidence: ReturnType<typeof resolveAcRunningConfidence>;
}) {
  const transition = getAcAutoTransitionBadge(data.ac_auto_state);
  const view = resolveAcStateView(data, acState);
  const runningBadge = getAcRunningBadge(
    view.runningFields,
    data.ac_estimated_running,
    { uncertain, confidence },
  );
  const operatingLabel = getAcOperatingModeLabel(operatingMode);

  const secondaryParts: string[] = [];
  if (operatingLabel !== "—") {
    secondaryParts.push(`${operatingLabel} 제어`);
  }
  if (runningBadge) {
    secondaryParts.push(runningBadge.label);
  }

  return (
    <section className={styles.statusCard} aria-label="지금 상태">
      <p className={styles.statusPrimary}>{modeText}</p>
      {secondaryParts.length > 0 ? (
        <p className={styles.statusSecondary}>{secondaryParts.join(" · ")}</p>
      ) : null}
      {transition.kind === "transition" ? (
        <p className={styles.statusMeta} title={transition.title}>
          {transition.label}
        </p>
      ) : null}
    </section>
  );
}

function getModeHelpCopy(
  operatingMode: AcOperatingMode | null,
  mode: AcMode,
  powerOff: boolean,
): string | null {
  if (powerOff) {
    return "위에서 켜거나, 집·외출 자동 조건이 맞으면 스스로 켜질 수 있어요.";
  }

  if (operatingMode === "away") {
    return "외출 중에는 온도·습도에 맞춰 에어컨을 켜고 끕니다.";
  }

  if (operatingMode === "auto" && mode === "cool") {
    return "켜기·끄기는 자동이고, 냉방만 유지합니다.";
  }

  if (operatingMode === "auto") {
    return "집에서 온도·습도에 따라 냉방·제습을 바꿉니다.";
  }

  if (mode === "cool") {
    return "선택한 냉방 모드로 동작합니다.";
  }

  if (mode === "dry") {
    return "제습은 전력이 낮아도 가동 중으로 보일 수 있어요.";
  }

  if (mode === "auto") {
    return "냉방·제습을 번갈아 선택합니다.";
  }

  return null;
}
