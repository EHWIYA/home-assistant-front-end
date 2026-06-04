import { Button } from "@/components/Button";
import type { AcMode, StatusResponse } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import { useAcState, type AcControlParams } from "@/hooks/useStatus";
import { useMutationErrorToast } from "@/hooks/useMutationErrorToast";
import { useQueryErrorToast } from "@/hooks/useQueryErrorToast";
import { TOAST_DEVICE, TOAST_GUIDE, TOAST_RESOURCE } from "@/utils/toastMessages";
import styles from "./AcModeControls.module.css";

interface AcModeControlsProps {
  data: StatusResponse;
  mutation: UseMutationResult<unknown, Error, AcControlParams, unknown>;
}

const MODE_OPTIONS: { mode: AcMode; label: string; className?: string }[] = [
  { mode: "off", label: "끄기" },
  { mode: "auto", label: "자동", className: styles.modeAuto },
  { mode: "cool", label: "냉방", className: styles.modeCool },
  { mode: "dry", label: "제습", className: styles.modeDry },
];

function isPendingFor(
  mutation: AcModeControlsProps["mutation"],
  match: (params: AcControlParams) => boolean,
): boolean {
  return mutation.isPending && mutation.variables != null && match(mutation.variables);
}

export function AcModeControls({ data, mutation }: AcModeControlsProps) {
  const acStateQuery = useAcState();
  const acState = acStateQuery.data;
  const mode = acState?.mode ?? data.ac_mode ?? "off";
  const autoEnabled = acState?.auto_enabled ?? data.ac_auto_enabled ?? false;
  const awayEnabled = acState?.away_enabled ?? data.ac_away_enabled ?? false;
  const autoKnown = data.ac_auto_enabled !== null && data.ac_auto_enabled !== undefined;
  const controlsDisabled = mutation.isPending || acStateQuery.isLoading;
  const post = (params: AcControlParams) => mutation.mutate(params);

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
    <section className={styles.card} aria-label="에어컨 제어">
      <h2 className={styles.sectionTitle}>제어</h2>

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
              {isPendingFor(
                mutation,
                (p) =>
                  p.mode === option.mode &&
                  p.auto_enabled === undefined &&
                  p.away_enabled === undefined,
              )
                ? "처리 중…"
                : option.label}
            </Button>
          );
        })}
      </div>

      <div className={styles.controlBlock}>
        <p className={styles.controlLabel}>자동제어</p>
        <div className={styles.segment} role="group" aria-label="자동제어">
          <button
            type="button"
            className={`${styles.segmentBtn} ${styles.segmentBtnOn} ${
              autoEnabled ? styles.segmentActive : ""
            }`.trim()}
            disabled={controlsDisabled || !autoKnown || autoEnabled === true}
            onClick={() => post({ mode, auto_enabled: true })}
          >
            {isPendingFor(mutation, (p) => p.auto_enabled === true)
              ? "…"
              : "ON"}
          </button>
          <button
            type="button"
            className={`${styles.segmentBtn} ${styles.segmentBtnOff} ${
              !autoEnabled && autoKnown ? styles.segmentActive : ""
            }`.trim()}
            disabled={controlsDisabled || !autoKnown || autoEnabled === false}
            onClick={() => post({ mode, auto_enabled: false })}
          >
            {isPendingFor(mutation, (p) => p.auto_enabled === false)
              ? "…"
              : "OFF"}
          </button>
        </div>
      </div>

      <div className={`${styles.controlBlock} ${styles.awayRow}`.trim()}>
        <p className={styles.controlLabel}>외출모드</p>
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
        <p className={styles.errorDetail}>상태 조회 실패 — 다시 시도해 주세요.</p>
      ) : null}
    </section>
  );
}
