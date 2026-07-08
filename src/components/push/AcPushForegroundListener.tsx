import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onMessage, type MessagePayload } from "firebase/messaging";
import { useToast } from "@/components/toast/ToastProvider";
import {
  resolvePushNavigationUrl,
  syncAcPushIfEnabled,
} from "@/push/acPush";
import { isFirebaseConfigured } from "@/push/config";
import { getOrInitMessaging, isPushMessagingSupported } from "@/push/firebase";

function getForegroundTitle(payload: MessagePayload): string {
  return (
    payload.notification?.title ??
    (typeof payload.data?.title === "string" ? payload.data.title : "에어컨 이상")
  );
}

function getForegroundBody(payload: MessagePayload): string {
  return (
    payload.notification?.body ??
    (typeof payload.data?.body === "string" ? payload.data.body : "")
  );
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
        const title = getForegroundTitle(payload);
        const body = getForegroundBody(payload);
        const message = body ? `${title}: ${body}` : title;
        showToast(message, { variant: "warn", category: "sync", durationMs: 6000 });

        const target = resolvePushNavigationUrl(
          payload.data as Record<string, string> | undefined,
        );
        navigate(target);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, showToast]);

  return null;
}
