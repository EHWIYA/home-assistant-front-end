import { StatusQueryGate } from "@/components/status/StatusQueryGate";
import { StatusFooter } from "@/components/status/StatusFooter";
import type { StatusResponse } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import {
  useAcControl,
  useAcState,
  usePlugToggle,
  type AcControlParams,
} from "@/hooks/useStatus";
import shared from "@/components/status/statusPage.module.css";
import {
  AcPushAlertCard,
  AcPushAlertLoadingCard,
  AcPushAlertMissingCard,
} from "./components/AcPushAlertCard";
import { AcAdvancedPanel } from "./components/AcAdvancedPanel";
import { AcModeControls } from "./components/AcModeControls";
import { AcPlugCard } from "./components/AcPlugCard";
import { AcStatusHero } from "./components/AcStatusHero";
import { useAcPushAlertDetail } from "./hooks/useAcPushAlertDetail";
import { useAcSyncWarning } from "./hooks/useAcSyncWarning";

export function AcPage() {
  const plugMutation = usePlugToggle();
  const acMutation = useAcControl();

  return (
    <StatusQueryGate loadingMessage="에어컨 상태 불러오는 중…">
      {({ data }) => (
        <AcPageContent
          data={data}
          acMutation={acMutation}
          plugMutation={plugMutation}
        />
      )}
    </StatusQueryGate>
  );
}

function AcPageContent({
  data,
  acMutation,
  plugMutation,
}: {
  data: StatusResponse;
  acMutation: UseMutationResult<unknown, Error, AcControlParams, unknown>;
  plugMutation: ReturnType<typeof usePlugToggle>;
}) {
  const acStateQuery = useAcState();
  const acState = acStateQuery.data;
  const { fromPush, alert, loading: pushAlertLoading, dismiss: dismissPushAlert } =
    useAcPushAlertDetail();
  const { showSyncWarning, isSettingMismatch, syncWarningTitle } = useAcSyncWarning(
    data,
    acState,
    acMutation,
    acStateQuery,
  );

  const reapplyAuto = () => {
    if (acMutation.isPending) return;
    acMutation.mutate({ mode: "auto", operating_mode: "auto" });
  };

  return (
    <div className={shared.page}>
      {fromPush && pushAlertLoading ? <AcPushAlertLoadingCard /> : null}
      {fromPush && !pushAlertLoading && alert ? (
        <AcPushAlertCard alert={alert} onDismiss={dismissPushAlert} />
      ) : null}
      {fromPush && !pushAlertLoading && !alert ? (
        <AcPushAlertMissingCard onDismiss={dismissPushAlert} />
      ) : null}
      <AcStatusHero
        data={data}
        acState={acState}
        showSyncWarning={showSyncWarning}
        isSettingMismatch={isSettingMismatch}
        syncWarningTitle={syncWarningTitle}
        onReapplyAuto={reapplyAuto}
        reapplyAutoPending={acMutation.isPending}
      />
      <div className={shared.pageSplit}>
        <div className={shared.pageStack}>
          <AcModeControls data={data} mutation={acMutation} />
          <AcPlugCard plug={data.plug} mutation={plugMutation} />
        </div>
        <AcAdvancedPanel
          data={data}
          acState={acState}
          showSyncWarning={showSyncWarning}
          syncWarningTitle={syncWarningTitle}
        />
      </div>
      <StatusFooter data={data} />
    </div>
  );
}
