import { Button } from "@/components/Button";
import { Badge } from "@/components/status/Badge";
import type { StatusResponse } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import type { AcMode } from "@/api/types";
import { useEffect, useMemo, useRef, useState } from "react";
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
  autoToggleMutation: UseMutationResult<unknown, Error, boolean, unknown>;
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
  autoToggleMutation,
  showDetails = true,
}: AcControlPanelProps) {
  const acStateQuery = useAcState();
  const lastNonOffModeRef = useRef<Extract<AcMode, "cool" | "dry">>("cool");
  const mode = acStateQuery.data?.mode ?? "off";
  const isAutoMode = acStateQuery.data?.auto_mode ?? false;
  const stateConsistent = acStateQuery.data?.state_consistent;
  const stateSource = acStateQuery.data?.state_source;
  const lastControlResult = acStateQuery.data?.last_control_result;
  const lastControlAtMs = parseControlTimestamp(acStateQuery.data?.last_control_at);
  const hasStateMismatch =
    (!data.ac_estimated_running && mode !== "off") ||
    (data.ac_estimated_running && mode === "off");
  const isInconsistent =
    typeof stateConsistent === "boolean" ? !stateConsistent : hasStateMismatch;
  const hasHardFailureSignal = mutation.isError || lastControlResult === "failed";
  const hasFetchFailureSignal = acStateQuery.isError || acStateQuery.errorUpdateCount >= 2;
  const isRecentSuccessfulControl =
    lastControlResult === "success" &&
    typeof lastControlAtMs === "number" &&
    Date.now() - lastControlAtMs <= RECENT_SUCCESS_SUPPRESS_MS;
  const showSyncWarning =
    isInconsistent &&
    (hasHardFailureSignal || hasFetchFailureSignal) &&
    !isRecentSuccessfulControl;
  const syncWarningTitle = stateSource
    ? `상태 소스(${stateSource}) 기준으로 정합성 확인 중입니다.`
    : "상태 소스 간 정합성 확인 중입니다.";
  const [displayTemperature, setDisplayTemperature] = useState<number | "-">("-");
  const [displayHumidity, setDisplayHumidity] = useState<number | "-">("-");
  const [isClimateStale, setIsClimateStale] = useState(false);
  const canToggleAuto = typeof data.ac_auto_enabled === "boolean";
  const nextAutoEnabled = data.ac_auto_enabled !== true;
  const nextPlugSwitchLabel = nextAutoEnabled ? "ON" : "OFF";
  const autoStateClassName =
    data.ac_auto_enabled === true
      ? styles.autoStateOn
      : data.ac_auto_enabled === false
        ? styles.autoStateOff
        : styles.autoStateUnknown;

  useMutationErrorToast(
    mutation,
    TOAST_DEVICE.ac,
    TOAST_GUIDE.syncRetry,
    "sync",
  );
  useMutationErrorToast(
    autoToggleMutation,
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

  useEffect(() => {
    const nextTemperature = acStateQuery.data?.temperature;
    const nextHumidity = acStateQuery.data?.humidity;
    const hasValidTemperature =
      typeof nextTemperature === "number" && Number.isFinite(nextTemperature);
    const hasValidHumidity =
      typeof nextHumidity === "number" && Number.isFinite(nextHumidity);

    if (hasValidTemperature) {
      setDisplayTemperature(nextTemperature);
    }
    if (hasValidHumidity) {
      setDisplayHumidity(nextHumidity);
    }
    if (hasValidTemperature || hasValidHumidity) {
      setIsClimateStale(false);
      return;
    }
    if (acStateQuery.isError) {
      setIsClimateStale(true);
    }
  }, [acStateQuery.data?.humidity, acStateQuery.data?.temperature, acStateQuery.isError]);

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
          showSyncWarning={showSyncWarning}
          syncWarningTitle={syncWarningTitle}
        />
      ) : null}
      <div className={styles.autoActions}>
        <Button
          fullWidth
          variant={nextAutoEnabled ? "secondary" : "danger"}
          className={`${nextAutoEnabled ? styles.autoEnable : styles.autoDisable} ${autoStateClassName}`}
          disabled={
            autoToggleMutation.isPending ||
            !canToggleAuto
          }
          onClick={() => autoToggleMutation.mutate(nextAutoEnabled)}
        >
          {autoToggleMutation.isPending
            ? "처리 중…"
            : nextAutoEnabled
              ? "자동제어 켜기 (플러그 ON)"
              : "자동제어 끄기 (플러그 OFF)"}
        </Button>
      </div>
      {canToggleAuto ? (
        <p className={shared.meta}>
          토글 시 자동제어와 플러그가 함께 {nextPlugSwitchLabel}으로 전환됩니다.
        </p>
      ) : null}
      {showDetails ? (
        <p className={shared.meta}>
          가동 추정은 플러그 전력 기준 (IR·자동 전환 이력과 무관)
        </p>
      ) : null}
      {showDetails ? <AcPolicyDetails /> : null}
      <div className={styles.statusBox}>
        {isClimateStale ? (
          <div className={shared.badgeRow}>
            <Badge variant="muted" title="재조회 지연으로 마지막 유효 센서값을 표시 중입니다.">
              센서값 지연(stale)
            </Badge>
          </div>
        ) : null}
        <p className={styles.statusText}>
          현재 온도 {displayTemperature}°C / 습도 {displayHumidity}%
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
      {showSyncWarning ? (
        <p className={shared.blockedHint}>
          장치 상태 동기화 중입니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}
      {data.ac_auto_enabled == null ? (
        <p className={shared.blockedHint}>
          자동제어 상태를 확인할 수 없어 토글이 비활성화되었습니다.
        </p>
      ) : null}
    </>
  );
}
