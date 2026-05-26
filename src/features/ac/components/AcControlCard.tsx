import { Card } from "@/components/Card";
import type { StatusResponse } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import type { OnOffAction } from "@/api/types";
import { AcControlPanel } from "./AcControlPanel";

interface AcControlCardProps {
  data: StatusResponse;
  acControlEnabled: boolean;
  mutation: UseMutationResult<unknown, Error, OnOffAction, unknown>;
}

export function AcControlCard({
  data,
  acControlEnabled,
  mutation,
}: AcControlCardProps) {
  return (
    <Card title="에어컨 제어">
      <AcControlPanel
        data={data}
        acControlEnabled={acControlEnabled}
        mutation={mutation}
        showDetails
      />
    </Card>
  );
}
