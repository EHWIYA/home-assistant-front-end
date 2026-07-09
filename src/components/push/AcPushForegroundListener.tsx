import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onMessage, type MessagePayload } from "firebase/messaging";
import { useToast } from "@/components/toast/ToastProvider";
import { syncAcPushIfEnabled } from "@/push/acPush";
import { syncAppBadgeCount } from "@/push/alertBadge";
import { resolvePushNavigationPath } from "@/push/alertNavigation";
import { parseAcPushAlertFromPayload } from "@/push/alertPayload";
import { syncPushHistoryFromServer } from "@/push/alertServerSync";
import { countUnreadAcPushAlerts, loadAcPushAlertHistory, persistAcPushAlert } from "@/push/alertStorage";
import { isFirebaseConfigured } from "@/push/config";
import { getOrInitMessaging, isPushMessagingSupported } from "@/push/firebase";

function getForegroundPreview(payload: MessagePayload): { title: string; body: string } {
  const alert = parseAcPushAlertFromPayload(payload);
  return { title: alert.title, body: alert.body };
}

function maybeShowOsNotification(alert: ReturnType<typeof parseAcPushAlertFromPayload>): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }

  try {
    const body = alert.body.replace(/\\n/g, "\n");
    const notification = new Notification(alert.title, {
      body,
      tag: alert.fingerprint,
      icon: "/icons/icon-192.png",
      data: {
        fingerprint: alert.fingerprint,
        url: alert.url,
        topic: alert.topic,
      },
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // iOS PWA 등 포그라운드 OS 알림 제한
  }
}

export function AcPushForegroundListener() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      return;
    }

    let cancelled = false;

    void (async () => {
      if (!(await isPushMessagingSupported())) {
        return;
      }

      await syncAcPushIfEnabled();
      await syncPushHistoryFromServer();
      if (cancelled) {
        return;
      }

      const messaging = getOrInitMessaging();
      onMessage(messaging, (payload) => {
        const alert = parseAcPushAlertFromPayload(payload);
        void persistAcPushAlert(alert).then(async () => {
          const history = await loadAcPushAlertHistory();
          void syncAppBadgeCount(countUnreadAcPushAlerts(history));
        });

        const { title, body } = getForegroundPreview(payload);
        const message = body ? `${title}: ${body}` : title;
        const targetPath = resolvePushNavigationPath(alert);

        showToast(message, {
          variant: "warn",
          category: "sync",
          durationMs: 8000,
          action: {
            label: "자세히",
            onClick: () => navigate(targetPath),
          },
        });

        maybeShowOsNotification(alert);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, showToast]);

  return null;
}
