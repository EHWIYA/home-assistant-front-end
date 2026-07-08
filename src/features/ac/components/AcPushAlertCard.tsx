import type { CSSProperties } from "react";
import bellSvg from "cupertino-icons-svg/svg/bell_fill.svg?raw";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { normalizeNotificationBody } from "@/push/alertPayload";
import { formatAcPushAlertTime } from "@/push/alertFormat";
import type { AcPushAlert } from "@/push/alertTypes";
import { HOME_DOMAIN_THEME } from "@/features/home/utils/homeDomainTheme";
import styles from "./AcPushAlertCard.module.css";

const theme = HOME_DOMAIN_THEME.ac;

function formatStatusLabel(status: string | undefined): string | null {
  if (!status?.trim()) {
    return null;
  }
  const normalized = status.trim().toLowerCase();
  if (normalized === "ok" || normalized === "pass") {
    return "정상";
  }
  if (normalized === "warn" || normalized === "warning") {
    return "주의";
  }
  if (normalized === "fail" || normalized === "error" || normalized === "alert") {
    return "이상";
  }
  return status;
}

interface AcPushAlertCardProps {
  alert: AcPushAlert;
  onDismiss: () => void;
  hideDismiss?: boolean;
}

export function AcPushAlertCard({ alert, onDismiss, hideDismiss = false }: AcPushAlertCardProps) {
  const body = normalizeNotificationBody(alert.body);
  const statusLabel = formatStatusLabel(alert.status ?? alert.overall);
  const timeLabel = alert.checkedAtKst?.trim() || formatAcPushAlertTime(alert.receivedAt);

  return (
    <section
      className={styles.card}
      style={{ "--ac-alert-accent": theme.accent } as CSSProperties}
      aria-label="푸시 알림 상세"
    >
      <header className={styles.head}>
        <div className={styles.headMain}>
          <CupertinoIcon svg={bellSvg} className={styles.headIcon} />
          <h2 className={styles.title}>에어컨 이상 알림</h2>
        </div>
        {hideDismiss ? null : (
          <button type="button" className={styles.dismiss} onClick={onDismiss}>
            닫기
          </button>
        )}
      </header>

      <h3 className={styles.alertTitle}>{alert.title}</h3>
      {body ? <p className={styles.body}>{body}</p> : null}

      <dl className={styles.meta}>
        <div className={styles.metaRow}>
          <dt>시각</dt>
          <dd>{timeLabel}</dd>
        </div>
        {alert.issueId ? (
          <div className={styles.metaRow}>
            <dt>이슈 ID</dt>
            <dd className={styles.mono}>{alert.issueId}</dd>
          </div>
        ) : null}
        {statusLabel ? (
          <div className={styles.metaRow}>
            <dt>상태</dt>
            <dd>
              <span className={styles.statusBadge}>{statusLabel}</span>
            </dd>
          </div>
        ) : null}
        {alert.llmEscalate ? (
          <div className={styles.metaRow}>
            <dt>LLM</dt>
            <dd>{alert.llmEscalate}</dd>
          </div>
        ) : null}
      </dl>

      {alert.summary && alert.summary.length > 0 ? (
        <div className={styles.summaryBlock}>
          <h4 className={styles.summaryTitle}>점검 상세</h4>
          <ul className={styles.summaryList}>
            {alert.summary.map((item, index) => {
              const itemStatus = formatStatusLabel(item.status);
              const key = `${item.name ?? "check"}-${index}`;
              return (
                <li key={key} className={styles.summaryItem}>
                  <div className={styles.summaryHead}>
                    <span className={styles.summaryName}>{item.name ?? `항목 ${index + 1}`}</span>
                    {itemStatus ? (
                      <span className={styles.summaryStatus}>{itemStatus}</span>
                    ) : null}
                  </div>
                  {item.detail ? <p className={styles.summaryDetail}>{item.detail}</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function AcPushAlertMissingCard({
  onDismiss,
  hideDismiss = false,
}: {
  onDismiss: () => void;
  hideDismiss?: boolean;
}) {
  return (
    <section
      className={styles.card}
      style={{ "--ac-alert-accent": theme.accent } as CSSProperties}
      aria-label="푸시 알림 상세"
    >
      <header className={styles.head}>
        <div className={styles.headMain}>
          <CupertinoIcon svg={bellSvg} className={styles.headIcon} />
          <h2 className={styles.title}>에어컨 이상 알림</h2>
        </div>
        {hideDismiss ? null : (
          <button type="button" className={styles.dismiss} onClick={onDismiss}>
            닫기
          </button>
        )}
      </header>
      <p className={styles.missing}>
        알림 내용을 불러오지 못했습니다. 설정의 최근 알림에서 다시 확인해 보세요.
      </p>
    </section>
  );
}

export function AcPushAlertLoadingCard() {
  return (
    <section
      className={styles.card}
      style={{ "--ac-alert-accent": theme.accent } as CSSProperties}
      aria-label="푸시 알림 불러오는 중"
      aria-busy="true"
    >
      <p className={styles.missing}>알림 내용을 불러오는 중…</p>
    </section>
  );
}
