import { Button } from "@/components/Button";
import type { StatusResponse } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import type { AcMode } from "@/api/types";
import { useEffect, useMemo, useRef } from "react";
import { useAcState } from "@/hooks/useStatus";
import shared from "@/components/status/statusPage.module.css";
import { useMutationErrorToast } from "@/hooks/useMutationErrorToast";
import { useQueryErrorToast } from "@/hooks/useQueryErrorToast";
import { TOAST_DEVICE, TOAST_GUIDE, TOAST_RESOURCE } from "@/utils/toastMessages";
import { AcPolicyDetails } from "./AcPolicyDetails";
import { AcStatusBadges } from "./AcStatusBadges";
import styles from "./AcControlPanel.module.css";

interface AcControlPanelProps {
  data: StatusResponse;
  mutation: UseMutationResult<unknown, Error, AcMode, unknown>;
  showDetails?: boolean;
}

export function AcControlPanel({
  data,
  mutation,
  showDetails = true,
}: AcControlPanelProps) {
  const acStateQuery = useAcState();
  const lastNonOffModeRef = useRef<Extract<AcMode, "cool" | "dry">>("cool");
  const mode = acStateQuery.data?.mode ?? "off";
  const isAutoMode = acStateQuery.data?.auto_mode ?? false;
  const hasStateMismatch =
    (!data.ac_estimated_running && mode !== "off") ||
    (data.ac_estimated_running && mode === "off");

  useMutationErrorToast(
    mutation,
    TOAST_DEVICE.ac,
    TOAST_GUIDE.syncRetry,
    "sync",
  );
  useQueryErrorToast({
    isError: acStateQuery.isError,
    error: acStateQuery.error,
    resourceLabel: TOAST_RESOURCE.acStatus,
    actionGuide: TOAST_GUIDE.retry,
  });

  useEffect(() => {
    if (mode === "cool" || mode === "dry") {
      lastNonOffModeRef.current = mode;
    }
  }, [mode]);

  const rightButton = useMemo(() => {
    if (mode === "off") {
      return { label: "켜기", className: styles.rightOn, nextMode: lastNonOffModeRef.current };
    }
    if (mode === "cool") {
      return { label: "제습", className: styles.rightDry, nextMode: "dry" as const };
    }
    return { label: "냉방", className: styles.rightCool, nextMode: "cool" as const };
  }, [mode]);

  const modeText = useMemo(() => {
    if (isAutoMode) {
      return "자동";
    }
    if (mode === "off") {
      return "끄기";
    }
    return mode === "cool" ? "냉방" : "제습";
  }, [isAutoMode, mode]);

  return (
    <>
      {showDetails ? <AcStatusBadges data={data} mode={mode} /> : null}
      {showDetails ? (
        <p className={shared.meta}>
          가동 추정은 플러그 전력 기준 (IR·자동 전환 이력과 무관)
        </p>
      ) : null}
      {showDetails ? <AcPolicyDetails /> : null}
      <div className={styles.statusBox}>
        <p className={styles.statusText}>
          현재 온도 {acStateQuery.data?.temperature ?? "-"}°C / 습도{" "}
          {acStateQuery.data?.humidity ?? "-"}%
        </p>
        <p className={styles.modeText}>모드: {modeText}</p>
      </div>
      <div className={styles.actions}>
        <Button
          fullWidth
          variant="danger"
          disabled={mutation.isPending || acStateQuery.isLoading || mode === "off"}
          onClick={() => mutation.mutate("off")}
        >
          {mutation.isPending && mutation.variables === "off" ? "처리 중…" : "끄기"}
        </Button>
        <Button
          fullWidth
          variant="secondary"
          className={rightButton.className}
          disabled={mutation.isPending || acStateQuery.isLoading}
          onClick={() => mutation.mutate(rightButton.nextMode)}
        >
          {mutation.isPending && mutation.variables === rightButton.nextMode
            ? "처리 중…"
            : rightButton.label}
        </Button>
      </div>
      {acStateQuery.isError ? (
        <p className={shared.errorDetail}>상태 조회 실패 — 다시 시도해 주세요.</p>
      ) : null}
      {hasStateMismatch ? (
        <p className={shared.blockedHint}>
          장치 상태 동기화 중입니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}
    </>
  );
}
