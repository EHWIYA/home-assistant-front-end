import { useCallback, useEffect, useState } from "react";
import { subscribeAcPushAlertEvents } from "@/push/alertEvents";
import {
  countUnreadAcPushAlerts,
  loadAcPushAlertHistory,
} from "@/push/alertStorage";
import type { AcPushAlert } from "@/push/alertTypes";

export function useAlertHistory() {
  const [alerts, setAlerts] = useState<AcPushAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const history = await loadAcPushAlertHistory();
    setAlerts(history);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadAcPushAlertHistory().then((history) => {
      if (!cancelled) {
        setAlerts(history);
        setLoading(false);
      }
    });

    const unsubscribe = subscribeAcPushAlertEvents((detail) => {
      if (detail.type === "saved" || detail.type === "synced" || detail.type === "cleared") {
        void loadAcPushAlertHistory().then((history) => {
          if (!cancelled) {
            setAlerts(history);
            setLoading(false);
          }
        });
        return;
      }

      if (detail.type === "read" && detail.fingerprint) {
        setAlerts((prev) =>
          prev.map((item) =>
            item.fingerprint === detail.fingerprint
              ? { ...item, readAt: new Date().toISOString() }
              : item,
          ),
        );
        return;
      }

      if (detail.type === "read-all") {
        const readAt = new Date().toISOString();
        setAlerts((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { alerts, loading, reload };
}

export function useUnreadAlertCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const history = await loadAcPushAlertHistory();
    setCount(countUnreadAcPushAlerts(history));
  }, []);

  useEffect(() => {
    let cancelled = false;

    void refresh().then(() => {
      if (cancelled) {
        return;
      }
    });

    const unsubscribe = subscribeAcPushAlertEvents(() => {
      void refresh();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refresh]);

  return count;
}
