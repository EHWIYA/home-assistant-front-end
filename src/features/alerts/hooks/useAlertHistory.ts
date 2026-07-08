import { useCallback, useEffect, useState } from "react";
import { loadAcPushAlertHistory } from "@/push/alertStorage";
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
    return () => {
      cancelled = true;
    };
  }, []);

  return { alerts, loading, reload };
}
