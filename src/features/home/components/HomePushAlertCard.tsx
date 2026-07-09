import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import bellSvg from "cupertino-icons-svg/svg/bell_fill.svg?raw";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { buildAlertDetailPath } from "@/push/alertPayload";
import { subscribeAcPushAlertEvents } from "@/push/alertEvents";
import { formatAcPushAlertTime } from "@/push/alertFormat";
import { isAcPushAlertUnread, loadAcPushAlertHistory } from "@/push/alertStorage";
import type { AcPushAlert } from "@/push/alertTypes";
import { getPushTopicMeta } from "@/push/pushTopics";
import { paths } from "@/routes/paths";
import styles from "./HomePushAlertCard.module.css";

export function HomePushAlertCard() {
  const [latestUnread, setLatestUnread] = useState<AcPushAlert | null>(null);

  useEffect(() => {
    let cancelled = false;

    const reload = async () => {
      const history = await loadAcPushAlertHistory();
      const unread = history.find((item) => isAcPushAlertUnread(item)) ?? null;
      if (!cancelled) {
        setLatestUnread(unread);
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
    <section
      className={styles.card}
      style={{ "--push-accent": topicMeta.accent } as CSSProperties}
      aria-label="최근 푸시 알림"
    >
      <div className={styles.head}>
        <CupertinoIcon svg={bellSvg} className={styles.icon} />
        <div>
          <p className={styles.eyebrow}>{topicMeta.label} · 미확인 알림</p>
          <h2 className={styles.title}>{latestUnread.title}</h2>
        </div>
      </div>
      {latestUnread.body ? <p className={styles.body}>{latestUnread.body}</p> : null}
      <div className={styles.footer}>
        <span className={styles.time}>{formatAcPushAlertTime(latestUnread.receivedAt)}</span>
        <div className={styles.links}>
          <Link to={buildAlertDetailPath(latestUnread.fingerprint)}>자세히</Link>
          <Link to={paths.alerts}>알림함</Link>
        </div>
      </div>
    </section>
  );
}
