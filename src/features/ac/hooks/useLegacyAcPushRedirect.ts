import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { buildAlertDetailPath } from "@/push/alertPayload";
import { paths } from "@/routes/paths";

/** 예전 /ac?from=push 링크를 알림함으로 리다이렉트 */
export function useLegacyAcPushRedirect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get("from") !== "push") {
      return;
    }

    const fingerprint = searchParams.get("fingerprint");
    navigate(fingerprint ? buildAlertDetailPath(fingerprint) : paths.alerts, {
      replace: true,
    });
  }, [navigate, searchParams]);
}
