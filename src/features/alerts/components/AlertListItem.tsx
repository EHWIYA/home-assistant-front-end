import { Link } from "react-router-dom";
import { normalizeNotificationBody, buildAlertDetailPath } from "@/push/alertPayload";
import { formatAcPushAlertTime } from "@/push/alertFormat";
import type { AcPushAlert } from "@/push/alertTypes";
import styles from "./AlertListItem.module.css";

interface AlertListItemProps {
  alert: AcPushAlert;
}

export function AlertListItem({ alert }: AlertListItemProps) {
  const body = normalizeNotificationBody(alert.body);

  return (
    <li>
      <Link className={styles.item} to={buildAlertDetailPath(alert.fingerprint)}>
        <span className={styles.itemTitle}>{alert.title}</span>
        {body ? <span className={styles.itemBody}>{body}</span> : null}
        <span className={styles.itemTime}>{formatAcPushAlertTime(alert.receivedAt)}</span>
      </Link>
    </li>
  );
}
