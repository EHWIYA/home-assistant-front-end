import type { AcThresholdsResponse } from "@/api/types";
import styles from "./AcPolicyDetails.module.css";

interface AcPolicyDetailsProps {
  thresholds?: AcThresholdsResponse;
  loading?: boolean;
}

export function AcPolicyDetails({ thresholds, loading }: AcPolicyDetailsProps) {
  const homeAuto = thresholds?.home_auto;
  const away = thresholds?.away;

  return (
    <details className={styles.policy}>
      <summary>자동·외출 정책 {thresholds?.version ? `(${thresholds.version})` : ""}</summary>
      {loading ? (
        <p className={styles.loading}>임계값 불러오는 중…</p>
      ) : (
        <ul className={styles.list}>
          {thresholds?.mutex ? (
            <li>
              <strong>운전모드</strong> — {thresholds.mutex}
            </li>
          ) : null}
          <li>
            <strong>집 자동 ON</strong> —{" "}
            {homeAuto?.on ??
              "27°C 이상 5분 또는 (24°C 이상·습도 70% 이상 10분)"}
          </li>
          <li>
            <strong>집 자동 OFF</strong> —{" "}
            {homeAuto?.off ??
              "25°C 미만·습도 55% 미만(각 10분 유지, 최소 가동 25분)"}
          </li>
          {homeAuto?.notes ? (
            <li>
              <strong>집 자동 참고</strong> — {homeAuto.notes}
            </li>
          ) : null}
          <li>
            <strong>외출 ON</strong> —{" "}
            {away?.on ??
              "28°C 이상 20분 또는 (25°C 이상·습도 68% 이상 20분)"}
          </li>
          <li>
            <strong>외출 OFF</strong> —{" "}
            {away?.off ?? "27°C 미만·습도 58% 미만"}
          </li>
          {away?.notes ? (
            <li>
              <strong>외출 참고</strong> — {away.notes}
            </li>
          ) : null}
          <li>
            <strong>모드 auto</strong> — HA가 cool/dry 선택. 가동 중 표시는
            last_run_mode(냉방/제습) 기준
          </li>
          <li>
          operating_mode=auto 이어도 제습 고정 가능 — 화면에서 제어 방식과 동작을
          구분 표기
          </li>
        </ul>
      )}
    </details>
  );
}
