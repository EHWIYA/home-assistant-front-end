import type { AcStateResponse, StatusResponse } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import type { AcControlParams } from "@/hooks/useStatus";
import { resolveAcStateView } from "@/utils/acStateView";

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

interface AcStateQueryFlags {
  isError: boolean;
  errorUpdateCount: number;
}

export function useAcSyncWarning(
  data: StatusResponse,
  acState: AcStateResponse | undefined,
  mutation: UseMutationResult<unknown, Error, AcControlParams, unknown>,
  acStateQuery: AcStateQueryFlags,
) {
  const view = resolveAcStateView(data, acState);
  const mode = view.mode;
  const stateConsistent = acState?.state_consistent;
  const stateSource = acState?.state_source;
  const runningSource = view.runningFields.running_source ?? acState?.running_source;
  const lastControlResult = acState?.last_control_result;
  const lastControlAtMs = parseControlTimestamp(acState?.last_control_at);
  const hasLegacyMismatch =
    (!data.ac_estimated_running && mode !== "off") ||
    (data.ac_estimated_running && mode === "off");
  const hasHardFailureSignal = mutation.isError || lastControlResult === "failed";
  const hasFetchFailureSignal =
    acStateQuery.isError || acStateQuery.errorUpdateCount >= 2;
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

  const isSettingMismatch = stateConsistent === false;

  const syncDebugLine = [
    `mode=${mode}`,
    `operating_mode=${view.operatingMode ?? "—"}`,
    `power=${view.power ?? "—"}`,
    `running_source=${runningSource ?? "—"}`,
    stateSource ? `state_source=${stateSource}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const syncWarningTitle = stateSource
    ? `state_consistent=false · ${stateSource}${runningSource ? ` · running_source=${runningSource}` : ""}`
    : runningSource
      ? `정합성 확인 중 · running_source=${runningSource}`
      : "mode·power·정합성 확인 중입니다.";

  return {
    showSyncWarning,
    isSettingMismatch,
    syncWarningTitle,
    syncDebugLine,
  };
}
