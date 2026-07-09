import { Link } from "react-router-dom";
import bellSvg from "cupertino-icons-svg/svg/bell_fill.svg?raw";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { useUnreadAlertCount } from "@/features/alerts/hooks/useAlertHistory";
import { paths } from "@/routes/paths";
import styles from "./AppHeaderAlertButton.module.css";

export function AppHeaderAlertButton() {
  const unreadCount = useUnreadAlertCount();

  return (
    <Link
      className={styles.button}
      to={paths.alerts}
      aria-label={unreadCount > 0 ? `알림함, 미읽음 ${unreadCount}건` : "알림함"}
    >
      <CupertinoIcon svg={bellSvg} className={styles.icon} />
      {unreadCount > 0 ? (
        <span className={styles.badge} aria-hidden>
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
