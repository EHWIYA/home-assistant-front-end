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

const RECENT_SUCCESS_SUPPRESS_MS = 30_000;

function parseControlTimestamp(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  const normalized = Date.parse(raw.replace(" ", "T"));
  return Number.isFinite(normalized) ? normalized : null;
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
  const acState = acStateQuery.data;
  const stateConsistent = acState?.state_consistent;
  const stateSource = acState?.state_source;
  const runningSource = acState?.running_source;
  const lastControlResult = acState?.last_control_result;
  const lastControlAtMs = parseControlTimestamp(acState?.last_control_at);
  const hasLegacyMismatch =
    (!data.ac_estimated_running && mode !== "off") ||
    (data.ac_estimated_running && mode === "off");
  const hasHardFailureSignal = mutation.isError || lastControlResult === "failed";
  const hasFetchFailureSignal = acStateQuery.isError || acStateQuery.errorUpdateCount >= 2;
  const isRecentSuccessfulControl =
    lastControlResult === "success" &&
    typeof lastControlAtMs === "number" &&
    Date.now() - lastControlAtMs <= RECENT_SUCCESS_SUPPRESS_MS;
  const showSyncWarning =
    typeof stateConsistent === "boolean"
      ? !stateConsistent
      : hasLegacyMismatch &&
        (hasHardFailureSignal || hasFetchFailureSignal) &&
        !isRecentSuccessfulControl;
  const syncWarningTitle = stateSource
    ? `state_consistent=false · ${stateSource}${runningSource ? ` · running_source=${runningSource}` : ""}`
    : runningSource
      ? `정합성 확인 중 · running_source=${runningSource}`
      : "mode·power·ac_auto_state 정합성 확인 중입니다.";

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
      {showDetails ? (
        <AcStatusBadges
          data={data}
          acState={acState}
          showSyncWarning={showSyncWarning}
          syncWarningTitle={syncWarningTitle}
        />
      ) : null}
      {showDetails ? (
        <p className={shared.meta}>
          가동 표시는 /ac/state(power·running_source) 우선. status의 50W 추정은
          미수신 시에만 보조합니다.
        </p>
      ) : null}
      {showDetails ? <AcPolicyDetails /> : null}
      <div className={styles.statusBox}>
        <p className={styles.modeText}>모드: {modeText}</p>
        {mode === "cool" ? (
          <p className={shared.meta}>
            냉방(cool) — 일반 냉방. 29°C 근처에서는 cool 선택이 필요합니다.
          </p>
        ) : null}
        {mode === "dry" ? (
          <p className={shared.meta}>
            제습(dry) — 저전력 IR 가동. 콘센트 전력이 낮아도 가동 중(저전력)으로
            표시될 수 있습니다.
          </p>
        ) : null}
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
      {showSyncWarning ? (
        <p className={shared.blockedHint}>
          장치 상태 동기화 중입니다. running_source·모드가 맞는지 확인한 뒤
          잠시 후 다시 시도해 주세요.
        </p>
      ) : null}
    </>
  );
}
