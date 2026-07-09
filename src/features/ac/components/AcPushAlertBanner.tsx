import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { buildAlertDetailPath } from "@/push/alertPayload";
import { subscribeAcPushAlertEvents } from "@/push/alertEvents";
import { isAcPushAlertUnread, loadAcPushAlertHistory } from "@/push/alertStorage";
import type { AcPushAlert } from "@/push/alertTypes";
import { getPushTopicMeta, isAcPushAlert } from "@/push/pushTopics";
import styles from "./AcPushAlertBanner.module.css";

export function AcPushAlertBanner() {
  const [latestUnread, setLatestUnread] = useState<AcPushAlert | null>(null);

  useEffect(() => {
    let cancelled = false;

    const reload = async () => {
      const history = await loadAcPushAlertHistory();
      const unreadAc = history.find(
        (item) => isAcPushAlertUnread(item) && isAcPushAlert(item),
      );
      if (!cancelled) {
        setLatestUnread(unreadAc ?? null);
      }
    };

    void reload();

    const unsubscribe = subscribeAcPushAlertEvents(() => {
      void reload();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (!latestUnread) {
    return null;
  }

  const topicMeta = getPushTopicMeta(latestUnread);

  return (
    <Link
      className={styles.banner}
      to={buildAlertDetailPath(latestUnread.fingerprint)}
      style={{ "--banner-accent": topicMeta.accent } as CSSProperties}
    >
      <span className={styles.label}>미확인 {topicMeta.label} 알림</span>
      <span className={styles.title}>{latestUnread.title}</span>
    </Link>
  );
}
