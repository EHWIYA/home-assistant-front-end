import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import type { StatusResponse } from "@/api/types";
import { useQueryErrorToast } from "@/hooks/useQueryErrorToast";
import { useStatus } from "@/hooks/useStatus";
import { TOAST_GUIDE, TOAST_RESOURCE } from "@/utils/toastMessages";
import styles from "./statusPage.module.css";

export interface StatusQueryContext {
  data: StatusResponse;
  isFetching: boolean;
}

interface StatusQueryGateProps {
  loadingMessage?: string;
  children: (ctx: StatusQueryContext) => ReactNode;
}

/** GET /status 로딩·오류 처리 — 페이지는 성공 시 children만 담당 (SRP). */
export function StatusQueryGate({
  loadingMessage = "상태 불러오는 중…",
  children,
}: StatusQueryGateProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useStatus();
  useQueryErrorToast({
    isError,
    error,
    resourceLabel: TOAST_RESOURCE.status,
    actionGuide: TOAST_GUIDE.checkNetworkAndApiConfig,
  });

  if (isLoading) {
    return <p className={styles.message}>{loadingMessage}</p>;
  }

  if (isError || !data) {
    return (
      <div className={styles.offline}>
        <p className={styles.message}>연결할 수 없습니다</p>
        <p className={styles.hint}>
          Tailscale·API 주소를 확인하세요. 401이면 GitHub Secret{" "}
          <code>VITE_API_KEY</code> 후 재배포가 필요합니다.
        </p>
        <p className={styles.errorDetail}>상태 조회 실패</p>
        <Button onClick={() => void refetch()}>다시 시도</Button>
      </div>
    );
  }

  return (
    <>
      {isFetching ? (
        <p className={styles.fetching} aria-live="polite">
          갱신 중…
        </p>
      ) : null}
      {children({ data, isFetching })}
    </>
  );
}
