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
