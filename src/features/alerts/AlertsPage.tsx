import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import bellSvg from "cupertino-icons-svg/svg/bell_fill.svg?raw";
import { Button } from "@/components/Button";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { AC_PUSH_ALERT_HISTORY_MAX } from "@/push/alertTypes";
import { clearAcPushAlertHistory } from "@/push/alertStorage";
import { paths } from "@/routes/paths";
import { AlertListItem } from "./components/AlertListItem";
import { useAlertHistory } from "./hooks/useAlertHistory";
import styles from "./AlertsPage.module.css";

const themeAccent = "#5b9fd4";

export function AlertsPage() {
  const { alerts, loading, reload } = useAlertHistory();

  const handleClear = async () => {
    const confirmed = window.confirm(
      "저장된 알림 기록을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
    );
    if (!confirmed) {
      return;
    }
    await clearAcPushAlertHistory();
    await reload();
  };

  return (
    <div className={styles.page}>
      <section
        className={styles.hero}
        style={{ "--alerts-accent": themeAccent } as CSSProperties}
        aria-label="알림함"
      >
        <div className={styles.heroHead}>
          <CupertinoIcon svg={bellSvg} className={styles.heroIcon} />
          <h1 className={styles.heroTitle}>알림함</h1>
        </div>
        <p className={styles.heroDesc}>
          푸시로 받은 제목·내용을 이 기기에만 저장합니다. 최근 {AC_PUSH_ALERT_HISTORY_MAX}건까지
          보관하며, 용량 절감을 위해 본문·점검 상세는 일부만 남깁니다.
        </p>
      </section>

      {loading ? (
        <p className={styles.message}>알림을 불러오는 중…</p>
      ) : alerts.length === 0 ? (
        <p className={styles.message}>아직 저장된 알림이 없습니다.</p>
      ) : (
        <ul className={styles.list}>
          {alerts.map((alert) => (
            <AlertListItem key={alert.fingerprint} alert={alert} />
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <Link className={styles.backLink} to={paths.settings}>
          설정으로
        </Link>
        {alerts.length > 0 ? (
          <Button variant="secondary" onClick={() => void handleClear()}>
            기록 삭제
          </Button>
        ) : null}
      </div>
    </div>
  );
}
