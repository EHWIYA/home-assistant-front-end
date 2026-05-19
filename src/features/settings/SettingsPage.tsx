import { Card } from "@/components/Card";
import { hasApiKey, isUsingMock } from "@/api/client";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
  const apiBase = import.meta.env.VITE_API_BASE_URL || "(미설정)";
  const mock = isUsingMock();

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

      <Card title="기록">
        <p className={styles.note}>
          전력 차트( GET /api/v1/history/power )는 2단계에서 추가됩니다.
        </p>
      </Card>
    </div>
  );
}
