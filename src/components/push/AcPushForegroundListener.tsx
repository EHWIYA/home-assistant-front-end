import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onMessage, type MessagePayload } from "firebase/messaging";
import { useToast } from "@/components/toast/ToastProvider";
import {
  buildAlertDetailPath,
  parseAcPushAlertFromPayload,
} from "@/push/alertPayload";
import { persistAcPushAlert } from "@/push/alertStorage";
import { syncAcPushIfEnabled } from "@/push/acPush";
import { isFirebaseConfigured } from "@/push/config";
import { getOrInitMessaging, isPushMessagingSupported } from "@/push/firebase";

function getForegroundPreview(payload: MessagePayload): { title: string; body: string } {
  const alert = parseAcPushAlertFromPayload(payload);
  return { title: alert.title, body: alert.body };
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
      if (cancelled) {
        return;
      }

      const messaging = getOrInitMessaging();
      onMessage(messaging, (payload) => {
        const alert = parseAcPushAlertFromPayload(payload);
        void persistAcPushAlert(alert);

        const { title, body } = getForegroundPreview(payload);
        const message = body ? `${title}: ${body}` : title;
        showToast(message, {
          variant: "warn",
          category: "sync",
          durationMs: 8000,
          action: {
            label: "자세히",
            onClick: () => navigate(buildAlertDetailPath(alert.fingerprint)),
          },
        });
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, showToast]);

  return null;
}
