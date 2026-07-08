import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { resolveAcPushAlert } from "@/push/alertStorage";
import type { AcPushAlert } from "@/push/alertTypes";

export function useAlertDetail() {
  const { fingerprint = "" } = useParams();
  const [alert, setAlert] = useState<AcPushAlert | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [fingerprint]);

  return { alert, loading, fingerprint };
}
