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
  const { showSyncWarning, syncWarningTitle } = useAcSyncWarning(
    data,
    acState,
    acMutation,
    acStateQuery,
  );

  return (
    <div className={shared.page}>
      <AcStatusHero
        data={data}
        acState={acState}
        showSyncWarning={showSyncWarning}
        syncWarningTitle={syncWarningTitle}
      />
      <AcModeControls data={data} mutation={acMutation} />
      <AcPlugCard plug={data.plug} mutation={plugMutation} />
      <AcAdvancedPanel
        data={data}
        acState={acState}
        showSyncWarning={showSyncWarning}
        syncWarningTitle={syncWarningTitle}
      />
      <StatusFooter data={data} />
    </div>
  );
}
