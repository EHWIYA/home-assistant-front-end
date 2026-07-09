import type { CSSProperties } from "react";
import gearSvg from "cupertino-icons-svg/svg/gear.svg?raw";
import powerSvg from "cupertino-icons-svg/svg/power.svg?raw";
import type { AcMode, AcOperatingMode, StatusResponse } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { useAcState, type AcControlParams } from "@/hooks/useStatus";
import { useMutationErrorToast } from "@/hooks/useMutationErrorToast";
import { useQueryErrorToast } from "@/hooks/useQueryErrorToast";
import { HOME_DOMAIN_THEME } from "@/features/home/utils/homeDomainTheme";
import {
  getAcActionOptions,
  getActionSectionTitle,
  getOperatingSectionTitle,
} from "@/utils/acActionOptions";
import {
  buildAcActionControlRequest,
  buildAcOperatingModeSwitchRequest,
  buildAcPowerOffRequest,
  buildAcPowerOnRequest,
} from "@/utils/acOperatingMode";
import {
  getAcModeDisplayText,
  isAcPowerOff,
  resolveAcUiActionMode,
} from "@/utils/acMode";
import { resolveAcStateView } from "@/utils/acStateView";
import { TOAST_DEVICE, TOAST_GUIDE, TOAST_RESOURCE } from "@/utils/toastMessages";
import styles from "./AcModeControls.module.css";

interface AcModeControlsProps {
  data: StatusResponse;
  mutation: UseMutationResult<unknown, Error, AcControlParams, unknown>;
}

const OPERATING_OPTIONS: {
  operatingMode: AcOperatingMode;
  label: string;
  tone: "manual" | "auto" | "away";
}[] = [
  { operatingMode: "manual", label: "수동", tone: "manual" },
  { operatingMode: "auto", label: "자동", tone: "auto" },
  { operatingMode: "away", label: "외출", tone: "away" },
];

function isPendingFor(
  mutation: AcModeControlsProps["mutation"],
  match: (params: AcControlParams) => boolean,
): boolean {
  return mutation.isPending && mutation.variables != null && match(mutation.variables);
}

function matchesOperatingMode(
  params: AcControlParams,
  operatingMode: AcOperatingMode,
): boolean {
  return params.operating_mode === operatingMode;
}

function matchesModeChange(
  params: AcControlParams,
  mode: AcMode,
  operatingMode: AcOperatingMode | null,
): boolean {
  const effective = operatingMode ?? "manual";
  return (
    params.mode === mode &&
    (params.operating_mode === effective ||
      (params.operating_mode == null && effective === "manual"))
  );
}

export function AcModeControls({ data, mutation }: AcModeControlsProps) {
  const theme = HOME_DOMAIN_THEME.ac;
  const acStateQuery = useAcState();
  const acState = acStateQuery.data;
  const view = resolveAcStateView(data, acState);
  const mode = view.mode;
  const lastRunMode = view.lastRunMode;
  const operatingMode = view.operatingMode;
  const operatingKnown = operatingMode != null;
  const controlsDisabled = mutation.isPending || acStateQuery.isLoading;
  const post = (params: AcControlParams) => mutation.mutate(params);
  const actionOptions = getAcActionOptions(operatingMode, mode);
  const actionColumns = actionOptions.length >= 4 ? 2 : 3;
  const uiActionMode = resolveAcUiActionMode({
    mode,
    operatingMode,
    lastRunMode,
    power: view.power,
    acAutoState: data.ac_auto_state,
    plugEstimatedRunning: data.ac_estimated_running,
  });
  const acPowerOff = isAcPowerOff(view.power, {
    acAutoState: data.ac_auto_state,
    plugEstimatedRunning: data.ac_estimated_running,
    statusMode: view.mode,
  });
  const modeDisplay = getAcModeDisplayText({
    mode,
    power: view.power,
    lastRunMode,
    operatingMode,
    acAutoState: data.ac_auto_state,
    plugEstimatedRunning: data.ac_estimated_running,
  });

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

  const handleOperatingMode = (next: AcOperatingMode) => {
    if (next === operatingMode) return;
    post(buildAcOperatingModeSwitchRequest(next, mode, lastRunMode));
  };

  const handleMode = (targetMode: AcMode) => {
    const params = buildAcActionControlRequest(targetMode, operatingMode);
    if (params.mode === mode && params.operating_mode === operatingMode) {
      return;
    }
    post(params);
  };

  const handlePowerToggle = () => {
    if (controlsDisabled) return;
    if (acPowerOff) {
      post(buildAcPowerOnRequest(operatingMode, mode, lastRunMode));
      return;
    }
    post(buildAcPowerOffRequest(operatingMode));
  };

  const powerTogglePending = isPendingFor(mutation, (p) =>
    acPowerOff ? p.mode !== "off" : p.mode === "off",
  );

  return (
    <section
      className={`${styles.card} ${acPowerOff ? styles.cardPowerOff : ""}`.trim()}
      style={{ "--ac-accent": theme.accent } as CSSProperties}
      aria-label="에어컨 제어"
    >
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <span className={styles.iconPill}>
            <CupertinoIcon svg={gearSvg} className="" />
          </span>
          <h2 className={styles.title}>제어</h2>
        </div>
        <button
          type="button"
          className={`${styles.powerToggle} ${
            acPowerOff ? styles.powerToggleOn : styles.powerToggleOff
          }`.trim()}
          disabled={controlsDisabled}
          aria-label={acPowerOff ? "에어컨 켜기" : "에어컨 끄기"}
          onClick={handlePowerToggle}
        >
          <span className={styles.powerToggleIcon} aria-hidden>
            <CupertinoIcon svg={powerSvg} className="" />
          </span>
          <span className={styles.powerToggleLabel}>
            {powerTogglePending ? "…" : acPowerOff ? "켜기" : "끄기"}
          </span>
        </button>
      </header>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitleWrap}>
            <span className={styles.stepBadge}>1</span>
            <p className={styles.sectionTitle}>{getOperatingSectionTitle()}</p>
          </div>
        </div>

        <div className={styles.opGrid} role="group" aria-label={getOperatingSectionTitle()}>
          {OPERATING_OPTIONS.map((option) => {
            const active = operatingMode === option.operatingMode;
            const pending = isPendingFor(mutation, (p) =>
              matchesOperatingMode(p, option.operatingMode),
            );
            return (
              <button
                key={option.operatingMode}
                type="button"
                className={`${styles.opTile} ${styles[`opTile_${option.tone}`]} ${
                  active ? styles.opTileActive : ""
                }`.trim()}
                aria-pressed={active}
                disabled={controlsDisabled || !operatingKnown}
                onClick={() => handleOperatingMode(option.operatingMode)}
              >
                {pending ? "…" : option.label}
              </button>
            );
          })}
        </div>

        {!operatingKnown ? (
          <p className={styles.warnLine}>상태를 확인할 수 없습니다.</p>
        ) : null}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitleWrap}>
            <span className={styles.stepBadge}>2</span>
            <p className={styles.sectionTitle}>{getActionSectionTitle(operatingMode)}</p>
          </div>
          <span className={styles.currentAction}>{modeDisplay}</span>
        </div>

        <div
          className={styles.actionGrid}
          style={{ "--action-cols": actionColumns } as CSSProperties}
          role="group"
          aria-label={getActionSectionTitle(operatingMode)}
        >
          {actionOptions.map((option) => {
            const active = uiActionMode === option.mode;
            const pending = isPendingFor(mutation, (p) => matchesModeChange(p, option.mode, operatingMode));
            return (
              <button
                key={option.mode}
                type="button"
                className={`${styles.actionTile} ${styles[`actionTile_${option.tone}`]} ${
                  active ? styles.actionTileActive : ""
                } ${option.blocked ? styles.actionTileBlocked : ""}`.trim()}
                disabled={controlsDisabled || option.blocked}
                title={option.blockReason}
                aria-pressed={active}
                onClick={() => handleMode(option.mode)}
              >
                {pending ? "…" : option.label}
              </button>
            );
          })}
        </div>
      </div>

      {acStateQuery.isError ? (
        <p className={styles.errorDetail}>상태 조회 실패</p>
      ) : null}
    </section>
  );
}
