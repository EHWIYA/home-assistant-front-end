import styles from "./AcPolicyDetails.module.css";

export function AcPolicyDetails() {
  return (
    <details className={styles.policy}>
      <summary>자동·외출 정책</summary>
      <ul className={styles.list}>
        <li>
          <strong>자동제어 마스터</strong> — 꺼짐이면 집안 자동 ON/OFF 중단. 외출모드와
          UI상 동시에 켜질 수 있으나 HA에서는 외출이 우선합니다.
        </li>
        <li>
          <strong>외출모드 ON</strong> — 28°C 이상 20분 유지 시 ON / (25°C 이상·습도
          68% 이상) 20분 유지 시 ON
        </li>
        <li>
          <strong>외출모드 OFF</strong> — 27°C 미만·습도 58% 미만이면 OFF
        </li>
        <li>
          <strong>모드 auto</strong> — HA가 cool/dry 선택. 가동 중 표시는
          last_run_mode(냉방/제습) 기준
        </li>
        <li>집 비움 → 자동 ON 불가, OFF는 조건 충족 시 가능</li>
        <li>켜기: 27°C 이상 5분 또는 (24°C 이상·습도 70% 이상 10분)</li>
        <li>
          끄기: 25°C 미만·습도 55% 미만(각 10분 유지, 최소 가동 25분)
        </li>
      </ul>
    </details>
  );
}
