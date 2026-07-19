import { StatusQueryGate } from "@/components/status/StatusQueryGate";
import { StatusFooter } from "@/components/status/StatusFooter";
import type { StatusResponse } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import {
  useAcControl,
  useAcRecover,
  useAcState,
  usePlugToggle,
  type AcControlParams,
} from "@/hooks/useStatus";
import shared from "@/components/status/statusPage.module.css";
import { AcPushAlertBanner } from "./components/AcPushAlertBanner";
import { AcAdvancedPanel } from "./components/AcAdvancedPanel";
import { AcModeControls } from "./components/AcModeControls";
import { AcPlugCard } from "./components/AcPlugCard";
import { AcStatusHero } from "./components/AcStatusHero";
import { useLegacyAcPushRedirect } from "./hooks/useLegacyAcPushRedirect";
import { useAcSyncWarning } from "./hooks/useAcSyncWarning";

export function AcPage() {
  useLegacyAcPushRedirect();

  const plugMutation = usePlugToggle();
  const acMutation = useAcControl();
  const recoverMutation = useAcRecover();

  return (
    <StatusQueryGate loadingMessage="에어컨 상태 불러오는 중…">
      {({ data }) => (
        <AcPageContent
          data={data}
          acMutation={acMutation}
          plugMutation={plugMutation}
          recoverMutation={recoverMutation}
        />
      )}
    </StatusQueryGate>
  );
}

function AcPageContent({
  data,
  acMutation,
  plugMutation,
  recoverMutation,
}: {
  data: StatusResponse;
  acMutation: UseMutationResult<unknown, Error, AcControlParams, unknown>;
  plugMutation: ReturnType<typeof usePlugToggle>;
  recoverMutation: ReturnType<typeof useAcRecover>;
}) {
  const acStateQuery = useAcState();
  const acState = acStateQuery.data;
  const { showSyncWarning, isSettingMismatch, syncWarningTitle, syncDebugLine } =
    useAcSyncWarning(data, acState, acMutation, acStateQuery);

  const reapplyAuto = () => {
    if (acMutation.isPending) return;
    acMutation.mutate({ mode: "auto", operating_mode: "auto" });
  };

  return (
    <div className={shared.page}>
      <AcPushAlertBanner />
      <AcStatusHero
        data={data}
        acState={acState}
        showSyncWarning={showSyncWarning}
        isSettingMismatch={isSettingMismatch}
        syncWarningTitle={syncWarningTitle}
        syncDebugLine={syncDebugLine}
        onReapplyAuto={reapplyAuto}
        reapplyAutoPending={acMutation.isPending}
      />
      <div className={shared.pageSplit}>
        <div className={shared.pageStack}>
          <AcModeControls data={data} mutation={acMutation} />
          <AcPlugCard
            plug={data.plug}
            acState={acState}
            mutation={plugMutation}
            recoverMutation={recoverMutation}
          />
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
