import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buildAcPushDetailPath } from "@/push/alertPayload";
import { mergeAcPushAlertHistoryFromIdb } from "@/push/alertStorage";
import type { AcPushAlert } from "@/push/alertTypes";
import styles from "./SettingsAcPushRecentAlerts.module.css";

function formatAlertTime(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) {
    return iso;
  }
  return new Date(parsed).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SettingsAcPushRecentAlerts() {
  const [alerts, setAlerts] = useState<AcPushAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void mergeAcPushAlertHistoryFromIdb().then((history) => {
      if (!cancelled) {
        setAlerts(history);
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

  if (alerts.length === 0) {
    return <p className={styles.empty}>아직 저장된 알림이 없습니다.</p>;
  }

  return (
    <ul className={styles.list}>
      {alerts.map((alert) => (
        <li key={alert.fingerprint}>
          <Link className={styles.item} to={buildAcPushDetailPath(alert.fingerprint)}>
            <span className={styles.itemTitle}>{alert.title}</span>
            {alert.body ? <span className={styles.itemBody}>{alert.body}</span> : null}
            <span className={styles.itemTime}>{formatAlertTime(alert.receivedAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
