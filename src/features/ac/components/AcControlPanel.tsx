import { OnOffActionButtons } from "@/components/status/OnOffActionButtons";
import type { StatusResponse } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import type { OnOffAction } from "@/api/types";
import shared from "@/components/status/statusPage.module.css";
import { AcPolicyDetails } from "./AcPolicyDetails";
import { AcStatusBadges } from "./AcStatusBadges";

interface AcControlPanelProps {
  data: StatusResponse;
  acControlEnabled: boolean;
  mutation: UseMutationResult<unknown, Error, OnOffAction, unknown>;
  showDetails?: boolean;
}

export function AcControlPanel({
  data,
  acControlEnabled,
  mutation,
  showDetails = true,
}: AcControlPanelProps) {
  return (
    <>
      {showDetails ? <AcStatusBadges data={data} /> : null}
      {showDetails ? (
        <p className={shared.meta}>
          가동 추정은 플러그 전력 기준 (IR·자동 전환 이력과 무관)
        </p>
      ) : null}
      {showDetails ? <AcPolicyDetails /> : null}
      {!acControlEnabled ? (
        <p className={shared.blockedHint}>
          플러그가 꺼져 있어 에어컨을 제어할 수 없습니다. 먼저 플러그를 켜
          주세요.
        </p>
      ) : null}
      <OnOffActionButtons
        disabled={!acControlEnabled}
        isPending={mutation.isPending}
        pendingAction={mutation.variables}
        onOn={() => mutation.mutate("on")}
        onOff={() => mutation.mutate("off")}
        error={mutation.isError}
      />
    </>
  );
}
