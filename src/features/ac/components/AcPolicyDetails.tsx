import styles from "./AcPolicyDetails.module.css";

export function AcPolicyDetails() {
  return (
    <details className={styles.policy}>
      <summary>자동제어 조건</summary>
      <ul className={styles.list}>
        <li>자동제어 꺼짐 → 자동 ON/OFF 중단</li>
        <li>집 비움 → 자동 ON 불가, OFF는 조건 충족 시 가능</li>
        <li>켜기: 27°C 이상 5분 또는 (24°C 이상·습도 70% 이상 10분)</li>
        <li>
          끄기: 25°C 미만·습도 55% 미만(각 10분 유지, 최소 가동 25분)
        </li>
      </ul>
    </details>
  );
}
