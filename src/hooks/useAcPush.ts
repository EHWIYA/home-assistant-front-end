import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import {
  disableAcPushNotifications,
  enableAcPushNotifications,
  checkAcPushPrerequisites,
  type AcPushBlockReason,
} from "@/push/acPush";
import { isFirebaseConfigured } from "@/push/config";
import { isPushMessagingSupported } from "@/push/firebase";
import { readAcPushEnabled } from "@/push/storage";

export type AcPushStatus =
  | "loading"
  | "off"
  | "on"
  | "blocked";

interface AcPushState {
  status: AcPushStatus;
  enabled: boolean;
  blockReason: AcPushBlockReason | null;
  blockMessage: string | null;
  busy: boolean;
}

export function useAcPushToggle() {
  const { showToast } = useToast();
  const [state, setState] = useState<AcPushState>({
    status: "loading",
    enabled: false,
    blockReason: null,
    blockMessage: null,
    busy: false,
  });

  const refresh = useCallback(async () => {
    if (!isFirebaseConfigured()) {
      setState({
        status: "blocked",
        enabled: false,
        blockReason: "unsupported",
        blockMessage: "Firebase 환경 변수가 설정되지 않았습니다.",
        busy: false,
      });
      return;
    }

    const supported = await isPushMessagingSupported();
    if (!supported) {
      setState({
        status: "blocked",
        enabled: false,
        blockReason: "unsupported",
        blockMessage: "이 브라우저에서는 Web Push를 지원하지 않습니다.",
        busy: false,
      });
      return;
    }

    const prereq = await checkAcPushPrerequisites();
    const enabled = readAcPushEnabled();

    if (!prereq.ok) {
      setState({
        status: "blocked",
        enabled,
        blockReason: prereq.reason,
        blockMessage: prereq.message,
        busy: false,
      });
      return;
    }

    setState({
      status: enabled ? "on" : "off",
      enabled,
      blockReason: null,
      blockMessage: null,
      busy: false,
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setEnabled = useCallback(
    async (next: boolean) => {
      setState((prev) => ({ ...prev, busy: true }));

      try {
        if (next) {
          const result = await enableAcPushNotifications();
          if (!result.ok) {
            showToast(result.message, { variant: "warn", category: "sync" });
            await refresh();
            return;
          }
          showToast("에어컨 이상 알림이 켜졌습니다.", {
            variant: "info",
            category: "sync",
          });
        } else {
          const result = await disableAcPushNotifications();
          if (!result.ok) {
            showToast(result.message, { variant: "error", category: "sync" });
            await refresh();
            return;
          }
          showToast("에어컨 이상 알림이 꺼졌습니다.", {
            variant: "info",
            category: "sync",
          });
        }
        await refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "알림 설정 중 오류가 발생했습니다.";
        showToast(message, { variant: "error", category: "sync" });
        await refresh();
      }
    },
    [refresh, showToast],
  );

  return { ...state, setEnabled, refresh };
}
