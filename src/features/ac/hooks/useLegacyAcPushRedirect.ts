import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { buildAlertDetailPath } from "@/push/alertPayload";
import { paths } from "@/routes/paths";

/** 레거시 `/ac?from=push` 딥링크 → 알림함 통일 (fingerprint 있으면 상세).
 *  신규 푸시 클릭은 alertNavigation / SW 규칙을 따름 (docs/api.md 「Push 랜딩」).
 */
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
