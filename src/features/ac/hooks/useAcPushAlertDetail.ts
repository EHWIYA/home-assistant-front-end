import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { AcPushAlert } from "@/push/alertTypes";
import { resolveAcPushAlert } from "@/push/alertStorage";

export function useAcPushAlertDetail() {
  const [searchParams, setSearchParams] = useSearchParams();
  const fromPush = searchParams.get("from") === "push";
  const fingerprint = searchParams.get("fingerprint");
  const [alert, setAlert] = useState<AcPushAlert | null>(null);
  const [loading, setLoading] = useState(fromPush);

  useEffect(() => {
    if (!fromPush) {
      setAlert(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void resolveAcPushAlert(fingerprint).then((resolved) => {
      if (cancelled) {
        return;
      }
      setAlert(resolved);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [fingerprint, fromPush]);

  const dismiss = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("from");
    next.delete("fingerprint");
    setSearchParams(next, { replace: true });
    setAlert(null);
  }, [searchParams, setSearchParams]);

  return {
    fromPush,
    alert,
    loading,
    dismiss,
  };
}
