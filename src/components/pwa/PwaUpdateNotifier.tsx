import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useToast } from "@/components/toast/ToastProvider";

const AUTO_UPDATE_DELAY_MS = 1800;

export function PwaUpdateNotifier() {
  const { showToast } = useToast();
  const didNotifyUpdateRef = useRef(false);
  const didNotifyOfflineRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const { needRefresh: [needRefresh], offlineReady: [offlineReady], updateServiceWorker } =
    useRegisterSW();

  useEffect(() => {
    if (!offlineReady || didNotifyOfflineRef.current) {
      return;
    }
    didNotifyOfflineRef.current = true;
    showToast("오프라인 캐시 준비가 완료되었습니다.", {
      variant: "info",
      category: "sync",
    });
  }, [offlineReady, showToast]);

  useEffect(() => {
    if (!needRefresh || didNotifyUpdateRef.current) {
      return;
    }

    didNotifyUpdateRef.current = true;
    showToast("새 버전이 배포되어 곧 최신 화면으로 갱신됩니다.", {
      variant: "info",
      category: "sync",
      durationMs: 2600,
    });

    timerRef.current = window.setTimeout(() => {
      void updateServiceWorker(true);
    }, AUTO_UPDATE_DELAY_MS);

    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [needRefresh, showToast, updateServiceWorker]);

  return null;
}
