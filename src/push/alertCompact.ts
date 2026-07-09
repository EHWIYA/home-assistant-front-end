import type { AcPushAlert } from "./alertTypes";
import {
  AC_PUSH_ALERT_BODY_MAX,
  AC_PUSH_ALERT_SUMMARY_JSON_MAX,
  AC_PUSH_ALERT_TITLE_MAX,
} from "./alertTypes";

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}…`;
}

/** IndexedDB·localStorage 용량 절감용 — 표시에 필요한 필드만 유지 */
export function compactAcPushAlertForStorage(alert: AcPushAlert): Record<string, unknown> {
  const compact: Record<string, unknown> = {
    fingerprint: alert.fingerprint,
    title: truncate(alert.title.trim(), AC_PUSH_ALERT_TITLE_MAX),
    body: truncate(alert.body, AC_PUSH_ALERT_BODY_MAX),
    receivedAt: alert.receivedAt,
  };

  if (alert.topic) compact.topic = alert.topic;
  if (alert.url) compact.url = alert.url;
  if (alert.issueId) compact.issueId = alert.issueId;
  if (alert.status) compact.status = alert.status;
  if (alert.overall) compact.overall = alert.overall;
  if (alert.checkedAtKst) compact.checkedAtKst = alert.checkedAtKst;
  if (alert.llmEscalate) compact.llmEscalate = alert.llmEscalate;
  if (alert.readAt) compact.readAt = alert.readAt;
  if (alert.serverId) compact.serverId = alert.serverId;

  if (alert.summary && alert.summary.length > 0) {
    const summaryJson = JSON.stringify(alert.summary);
    compact.summaryJson = truncate(summaryJson, AC_PUSH_ALERT_SUMMARY_JSON_MAX);
  }

  return compact;
}
