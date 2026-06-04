import type { AcThresholdRule, AcThresholdsResponse } from "@/api/types";
import panelStyles from "./AcAdvancedPanel.module.css";
import styles from "./AcPolicyDetails.module.css";

interface AcPolicyDetailsProps {
  thresholds?: AcThresholdsResponse;
  loading?: boolean;
}

const DEFAULT_HOME_ON =
  "27°C 이상 5분 또는 (24°C 이상·습도 70% 이상 10분)";
const DEFAULT_HOME_OFF =
  "25°C 미만·습도 55% 미만(각 10분 유지, 최소 가동 25분)";
const DEFAULT_AWAY_ON =
  "28°C 이상 20분 또는 (25°C 이상·습도 68% 이상 20분)";
const DEFAULT_AWAY_OFF = "27°C 미만·습도 58% 미만";

function ThresholdBody({ rule, fallbackOn, fallbackOff }: {
  rule: AcThresholdRule | undefined;
  fallbackOn: string;
  fallbackOff: string;
}) {
  return (
    <div className={styles.detailBody}>
      <p className={styles.detailRow}>
        <span className={styles.detailLabel}>켜기</span>
        <span>{rule?.on ?? fallbackOn}</span>
      </p>
      <p className={styles.detailRow}>
        <span className={styles.detailLabel}>끄기</span>
        <span>{rule?.off ?? fallbackOff}</span>
      </p>
      {rule?.notes ? <p className={styles.detailNote}>{rule.notes}</p> : null}
    </div>
  );
}

export function AcPolicyDetails({ thresholds, loading }: AcPolicyDetailsProps) {
  if (loading) {
    return <p className={styles.loading}>조건 불러오는 중…</p>;
  }

  const home = thresholds?.home_auto;
  const away = thresholds?.away;

  return (
    <div className={styles.root}>
      <ul className={styles.overview}>
        <li>
          <strong>집 자동</strong> — 더우거나 습하면 켜고, 선선하고 건조하면 끕니다.
        </li>
        <li>
          <strong>외출</strong> — 외출 중 더우거나 습하면 켜고, 괜찮아지면 끕니다.
        </li>
      </ul>

      <details className={panelStyles.subFold}>
        <summary>집 자동 — 온도·습도 조건</summary>
        <ThresholdBody
          rule={home}
          fallbackOn={DEFAULT_HOME_ON}
          fallbackOff={DEFAULT_HOME_OFF}
        />
      </details>

      <details className={panelStyles.subFold}>
        <summary>외출 — 온도·습도 조건</summary>
        <ThresholdBody
          rule={away}
          fallbackOn={DEFAULT_AWAY_ON}
          fallbackOff={DEFAULT_AWAY_OFF}
        />
      </details>

      <p className={styles.hint}>
        자동·외출·수동은 한 번에 하나만 켤 수 있어요.
        {thresholds?.version ? ` (${thresholds.version})` : ""}
      </p>
    </div>
  );
}
