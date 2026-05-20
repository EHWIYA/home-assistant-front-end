import { Card } from "@/components/Card";
import { hasApiKey, isUsingMock } from "@/api/client";
import { useHealth } from "@/hooks/useHealth";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
  const apiBase = import.meta.env.VITE_API_BASE_URL || "(미설정)";
  const mock = isUsingMock();
  const health = useHealth(!mock);

  return (
    <div className={styles.page}>
      <Card title="API">
        <dl className={styles.list}>
          <div>
            <dt>Base URL</dt>
            <dd>{apiBase}</dd>
          </div>
          <div>
            <dt>데이터 소스</dt>
            <dd>{mock ? "Mock (개발)" : "iot-api"}</dd>
          </div>
          <div>
            <dt>API Key</dt>
            <dd>{mock ? "—" : hasApiKey() ? "빌드에 포함됨" : "미설정 (401 가능)"}</dd>
          </div>
        </dl>
      </Card>

      <Card title="접속">
        <p className={styles.note}>
          Tailscale을 켠 뒤{" "}
          <a href="https://iot.iwhya.kr" className={styles.link}>
            iot.iwhya.kr
          </a>
          에 접속하세요. iOS는 Safari → 공유 → 홈 화면에 추가로 PWA를 설치할 수
          있습니다.
        </p>
      </Card>

      <Card title="서버 상태">
        {mock ? (
          <p className={styles.note}>Mock 모드에서는 health를 조회하지 않습니다.</p>
        ) : health.isLoading ? (
          <p className={styles.note}>확인 중…</p>
        ) : health.isError ? (
          <p className={styles.note}>GET /health 실패 — API 연결을 확인하세요.</p>
        ) : (
          <dl className={styles.list}>
            <div>
              <dt>DB</dt>
              <dd>
                {health.data?.db_reachable === true
                  ? "연결됨"
                  : health.data?.db_reachable === false
                    ? "연결 안 됨"
                    : "—"}
              </dd>
            </div>
            {health.data?.status ? (
              <div>
                <dt>status</dt>
                <dd>{health.data.status}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </Card>

      <Card title="기능">
        <p className={styles.note}>
          멀티탭(헤이홈 4구)·스케줄은 하단 「멀티탭」 탭에서 제어합니다. 프리셋은
          백엔드 시드 후 지원 예정입니다.
        </p>
      </Card>
    </div>
  );
}
