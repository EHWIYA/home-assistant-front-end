/** FCM data.summary 항목 (NAS active checks JSON) */
export interface AcPushCheckDetail {
  name?: string;
  status?: string;
  detail?: string;
}

/** 저장·표시용 푸시 알림 (현재 AC 중심, topic으로 확장) */
export interface AcPushAlert {
  fingerprint: string;
  title: string;
  body: string;
  receivedAt: string;
  /** 상세 진입 시각 — 미읽음 판별 */
  readAt?: string;
  /** NAS 히스토리 API id (Phase 6) */
  serverId?: string;
  topic?: string;
  url?: string;
  issueId?: string;
  status?: string;
  overall?: string;
  checkedAtKst?: string;
  llmEscalate?: string;
  summary?: AcPushCheckDetail[];
}

/** 알림함 최대 보관 개수 (IndexedDB 단일 저장) */
export const AC_PUSH_ALERT_HISTORY_MAX = 30;
export const AC_PUSH_ALERT_BODY_MAX = 1200;
export const AC_PUSH_ALERT_TITLE_MAX = 200;
export const AC_PUSH_ALERT_SUMMARY_JSON_MAX = 4000;
export const AC_PUSH_LAST_FINGERPRINT_KEY = "hwiya-ac-last-alert-fp";
/** @deprecated IndexedDB 단일화 — 마이그레이션 후 제거 */
export const AC_PUSH_LAST_ALERT_KEY = "hwiya-ac-last-alert";
/** @deprecated IndexedDB 단일화 — 마이그레이션 후 제거 */
export const AC_PUSH_ALERT_HISTORY_KEY = "hwiya-ac-alert-history";
export const AC_PUSH_IDB_NAME = "hwiya-ac-push";
export const AC_PUSH_IDB_STORE = "alerts";
