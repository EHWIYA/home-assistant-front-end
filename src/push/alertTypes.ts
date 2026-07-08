/** FCM data.summary 항목 (NAS active checks JSON) */
export interface AcPushCheckDetail {
  name?: string;
  status?: string;
  detail?: string;
}

/** 저장·표시용 에어컨 푸시 알림 */
export interface AcPushAlert {
  fingerprint: string;
  title: string;
  body: string;
  receivedAt: string;
  topic?: string;
  url?: string;
  issueId?: string;
  status?: string;
  overall?: string;
  checkedAtKst?: string;
  llmEscalate?: string;
  summary?: AcPushCheckDetail[];
}

export const AC_PUSH_ALERT_HISTORY_MAX = 10;
export const AC_PUSH_LAST_ALERT_KEY = "hwiya-ac-last-alert";
export const AC_PUSH_ALERT_HISTORY_KEY = "hwiya-ac-alert-history";
export const AC_PUSH_IDB_NAME = "hwiya-ac-push";
export const AC_PUSH_IDB_STORE = "alerts";
