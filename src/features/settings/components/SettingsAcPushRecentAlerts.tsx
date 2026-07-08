import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buildAlertDetailPath } from "@/push/alertPayload";
import { formatAcPushAlertTime } from "@/push/alertFormat";
import { loadAcPushAlertHistory } from "@/push/alertStorage";
import type { AcPushAlert } from "@/push/alertTypes";
import { paths } from "@/routes/paths";
import styles from "./SettingsAcPushRecentAlerts.module.css";

const SETTINGS_RECENT_LIMIT = 3;

export function SettingsAcPushRecentAlerts() {
  const [alerts, setAlerts] = useState<AcPushAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadAcPushAlertHistory().then((history) => {
      if (!cancelled) {
        setAlerts(history.slice(0, SETTINGS_RECENT_LIMIT));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className={styles.hint}>최근 알림을 불러오는 중…</p>;
  }

  return (
    <>
      {alerts.length === 0 ? (
        <p className={styles.empty}>아직 저장된 알림이 없습니다.</p>
      ) : (
        <ul className={styles.list}>
          {alerts.map((alert) => (
            <li key={alert.fingerprint}>
              <Link className={styles.item} to={buildAlertDetailPath(alert.fingerprint)}>
                <span className={styles.itemTitle}>{alert.title}</span>
                {alert.body ? <span className={styles.itemBody}>{alert.body}</span> : null}
                <span className={styles.itemTime}>{formatAcPushAlertTime(alert.receivedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link className={styles.inboxLink} to={paths.alerts}>
        알림함 전체 보기
      </Link>
    </>
  );
}
