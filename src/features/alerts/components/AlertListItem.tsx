import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { normalizeNotificationBody, buildAlertDetailPath } from "@/push/alertPayload";
import { formatAcPushAlertTime } from "@/push/alertFormat";
import { isAcPushAlertUnread } from "@/push/alertStorage";
import type { AcPushAlert } from "@/push/alertTypes";
import { getPushTopicMeta } from "@/push/pushTopics";
import styles from "./AlertListItem.module.css";

interface AlertListItemProps {
  alert: AcPushAlert;
}

export function AlertListItem({ alert }: AlertListItemProps) {
  const body = normalizeNotificationBody(alert.body);
  const unread = isAcPushAlertUnread(alert);
  const topicMeta = getPushTopicMeta(alert);

  return (
    <li>
      <Link
        className={`${styles.item} ${unread ? styles.itemUnread : ""}`.trim()}
        to={buildAlertDetailPath(alert.fingerprint)}
        style={{ "--alert-accent": topicMeta.accent } as CSSProperties}
      >
        <div className={styles.itemHead}>
          <span className={styles.topicBadge}>{topicMeta.label}</span>
          {unread ? <span className={styles.unreadDot} aria-label="미읽음" /> : null}
        </div>
        <span className={styles.itemTitle}>{alert.title}</span>
        {body ? <span className={styles.itemBody}>{body}</span> : null}
        <span className={styles.itemTime}>{formatAcPushAlertTime(alert.receivedAt)}</span>
      </Link>
    </li>
  );
}
