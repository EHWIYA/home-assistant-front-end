import { useEffect } from "react";
import { syncAppBadgeCount } from "@/push/alertBadge";
import { syncPushHistoryFromServer } from "@/push/alertServerSync";
import { countUnreadAcPushAlerts, loadAcPushAlertHistory } from "@/push/alertStorage";
import { subscribeAcPushAlertEvents } from "@/push/alertEvents";

/** 앱 전역: 서버 히스토리 동기화 + PWA 배지 갱신 */
export function PushAlertSyncBootstrap() {
  useEffect(() => {
    let cancelled = false;

    const refreshBadge = async () => {
      const history = await loadAcPushAlertHistory();
      if (!cancelled) {
        await syncAppBadgeCount(countUnreadAcPushAlerts(history));
      }
    };

    void syncPushHistoryFromServer().then(() => refreshBadge());
    void refreshBadge();

    const unsubscribe = subscribeAcPushAlertEvents(() => {
      void refreshBadge();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return null;
}
