import { Card } from "@/components/Card";
import type { StatusResponse } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import type { AcMode } from "@/api/types";
import { AcControlPanel } from "./AcControlPanel";

interface AcControlCardProps {
  data: StatusResponse;
  mutation: UseMutationResult<unknown, Error, AcMode, unknown>;
}

export function AcControlCard({ data, mutation }: AcControlCardProps) {
  return (
    <Card title="에어컨 제어">
      <AcControlPanel
        data={data}
        mutation={mutation}
        showDetails
      />
    </Card>
  );
}
