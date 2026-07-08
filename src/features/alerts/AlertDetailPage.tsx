import { Link } from "react-router-dom";
import {
  AcPushAlertCard,
  AcPushAlertLoadingCard,
  AcPushAlertMissingCard,
} from "@/features/ac/components/AcPushAlertCard";
import { paths } from "@/routes/paths";
import { useAlertDetail } from "./hooks/useAlertDetail";
import styles from "./AlertDetailPage.module.css";

export function AlertDetailPage() {
  const { alert, loading } = useAlertDetail();

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} to={paths.alerts}>
        ← 알림함
      </Link>

      {loading ? <AcPushAlertLoadingCard /> : null}
      {!loading && alert ? (
        <AcPushAlertCard alert={alert} onDismiss={() => undefined} hideDismiss />
      ) : null}
      {!loading && !alert ? <AcPushAlertMissingCard onDismiss={() => undefined} hideDismiss /> : null}
    </div>
  );
}
