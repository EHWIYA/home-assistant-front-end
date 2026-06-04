import { Button } from "@/components/Button";
import type { StatusResponse } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import type { AcMode } from "@/api/types";
import { useMemo } from "react";
import { useAcState, type AcControlParams } from "@/hooks/useStatus";
import shared from "@/components/status/statusPage.module.css";
import { useMutationErrorToast } from "@/hooks/useMutationErrorToast";
import { useQueryErrorToast } from "@/hooks/useQueryErrorToast";
import { TOAST_DEVICE, TOAST_GUIDE, TOAST_RESOURCE } from "@/utils/toastMessages";
import { getAcModeDisplayText } from "@/utils/acMode";
import { AcPolicyDetails } from "./AcPolicyDetails";
import { AcStatusBadges } from "./AcStatusBadges";
import styles from "./AcControlPanel.module.css";

interface AcControlPanelProps {
  data: StatusResponse;
  mutation: UseMutationResult<unknown, Error, AcControlParams, unknown>;
  showDetails?: boolean;
}

const MODE_OPTIONS: { mode: AcMode; label: string; className?: string }[] = [
  { mode: "off", label: "끄기" },
  { mode: "auto", label: "자동", className: styles.modeAuto },
  { mode: "cool", label: "냉방", className: styles.modeCool },
  { mode: "dry", label: "제습", className: styles.modeDry },
];

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

function isPendingFor(
  mutation: AcControlPanelProps["mutation"],
  match: (params: AcControlParams) => boolean,
): boolean {
  return mutation.isPending && mutation.variables != null && match(mutation.variables);
}

export function AcControlPanel({
  data,
  mutation,
  showDetails = true,
}: AcControlPanelProps) {
  const acStateQuery = useAcState();
  const acState = acStateQuery.data;
  const mode = acState?.mode ?? data.ac_mode ?? "off";
  const autoEnabled = acState?.auto_enabled ?? data.ac_auto_enabled ?? false;
  const awayEnabled = acState?.away_enabled ?? data.ac_away_enabled ?? false;
  const lastRunMode = acState?.last_run_mode ?? data.ac_last_run_mode ?? null;
  const power = acState?.power;
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
      : "mode·power·정합성 확인 중입니다.";

  const modeText = useMemo(
    () => getAcModeDisplayText({ mode, power, lastRunMode }),
    [mode, power, lastRunMode],
  );

  const post = (params: AcControlParams) => mutation.mutate(params);
  const autoKnown = data.ac_auto_enabled !== null && data.ac_auto_enabled !== undefined;
  const controlsDisabled = mutation.isPending || acStateQuery.isLoading;

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
          가동 표시는 /ac/state(power·running_source) 우선. 외출모드가 켜지면 HA에서
          외출 정책이 자동제어보다 우선합니다.
        </p>
      ) : null}
      {showDetails ? <AcPolicyDetails /> : null}
      <div className={styles.statusBox}>
        <p className={styles.modeText}>모드: {modeText}</p>
        {awayEnabled ? (
          <p className={shared.meta}>
            외출모드 동작 중 — 실내 28°C 이상 또는 (25°C 이상·습도 68% 이상) 20분
            유지 시 ON, 27°C 미만·습도 58% 미만 시 OFF
          </p>
        ) : null}
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
        {mode === "auto" ? (
          <p className={shared.meta}>
            자동(auto) — HA가 cool/dry를 선택합니다. 가동 중에는 마지막 실행
            모드(last_run_mode)를 표시합니다.
          </p>
        ) : null}
      </div>

      <div className={styles.modeGrid} role="group" aria-label="에어컨 모드">
        {MODE_OPTIONS.map((option) => {
          const active = mode === option.mode;
          return (
            <Button
              key={option.mode}
              fullWidth
              variant={active ? "primary" : "secondary"}
              className={active ? styles.modeActive : option.className}
              disabled={controlsDisabled}
              onClick={() => post({ mode: option.mode })}
            >
              {isPendingFor(mutation, (p) => p.mode === option.mode && p.auto_enabled === undefined && p.away_enabled === undefined)
                ? "처리 중…"
                : option.label}
            </Button>
          );
        })}
      </div>

      <div className={styles.autoActions} role="group" aria-label="자동제어 마스터">
        <Button
          fullWidth
          variant="secondary"
          className={`${styles.autoEnable} ${autoEnabled ? styles.autoStateOn : ""}`}
          disabled={controlsDisabled || !autoKnown || autoEnabled === true}
          onClick={() => post({ mode, auto_enabled: true })}
        >
          {isPendingFor(mutation, (p) => p.auto_enabled === true)
            ? "처리 중…"
            : "자동제어 켜기"}
        </Button>
        <Button
          fullWidth
          variant="secondary"
          className={`${styles.autoDisable} ${!autoEnabled ? styles.autoStateOff : ""}`}
          disabled={controlsDisabled || !autoKnown || autoEnabled === false}
          onClick={() => post({ mode, auto_enabled: false })}
        >
          {isPendingFor(mutation, (p) => p.auto_enabled === false)
            ? "처리 중…"
            : "자동제어 끄기"}
        </Button>
      </div>

      <div className={styles.awayRow}>
        <Button
          fullWidth
          variant={awayEnabled ? "primary" : "secondary"}
          className={awayEnabled ? styles.awayOn : styles.awayOff}
          disabled={controlsDisabled}
          onClick={() => post({ mode, away_enabled: !awayEnabled })}
        >
          {isPendingFor(mutation, (p) => typeof p.away_enabled === "boolean")
            ? "처리 중…"
            : awayEnabled
              ? "외출모드 끄기"
              : "외출모드 켜기"}
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
