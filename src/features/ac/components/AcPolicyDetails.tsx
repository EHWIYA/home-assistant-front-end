import type { AcThresholdRule, AcThresholdsResponse } from "@/api/types";
import panelStyles from "./AcAdvancedPanel.module.css";
import styles from "./AcPolicyDetails.module.css";

interface AcPolicyDetailsProps {
  thresholds?: AcThresholdsResponse;
  loading?: boolean;
  error?: boolean;
}

function ThresholdBody({ rule }: { rule: AcThresholdRule }) {
  return (
    <div className={styles.detailBody}>
      <p className={styles.detailRow}>
        <span className={styles.detailLabel}>켜기</span>
        <span>{rule.on}</span>
      </p>
      <p className={styles.detailRow}>
        <span className={styles.detailLabel}>끄기</span>
        <span>{rule.off}</span>
      </p>
      {rule.notes ? <p className={styles.detailNote}>{rule.notes}</p> : null}
    </div>
  );
}

export function AcPolicyDetails({
  thresholds,
  loading,
  error,
}: AcPolicyDetailsProps) {
  if (loading) {
    return <p className={styles.loading}>조건 불러오는 중…</p>;
  }

  if (error || !thresholds?.home_auto || !thresholds?.away) {
    return (
      <p className={styles.loading} role="status">
        일시적으로 임계값을 불러오지 못했습니다.
      </p>
    );
  }

  const home = thresholds.home_auto;
  const away = thresholds.away;

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
        <ThresholdBody rule={home} />
      </details>

      <details className={panelStyles.subFold}>
        <summary>외출 — 온도·습도 조건</summary>
        <ThresholdBody rule={away} />
      </details>

      <p className={styles.hint}>
        자동·외출·수동은 한 번에 하나만 켤 수 있어요.
        {thresholds.version ? ` (${thresholds.version})` : ""}
      </p>
    </div>
  );
}
