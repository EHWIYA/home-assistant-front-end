import { Card } from "@/components/Card";
import type { PcStatus, StatusResponse } from "@/api/types";
import { useAcControl, usePcToggle, usePlugToggle } from "@/hooks/useStatus";
import { AcControlPanel } from "@/features/ac/components/AcControlPanel";
import { PlugSection } from "@/features/ac/components/PlugSection";
import { OnOffActionButtons } from "@/components/status/OnOffActionButtons";
import {
  isPcControllable,
  requestPcToggle,
} from "@/utils/pcStatus";
import shared from "@/components/status/statusPage.module.css";
import styles from "./HomeQuickControls.module.css";

interface HomeQuickControlsProps {
  data: StatusResponse;
}

export function HomeQuickControls({ data }: HomeQuickControlsProps) {
  const plugMutation = usePlugToggle();
  const acMutation = useAcControl();
  const pcMutation = usePcToggle();

  return (
    <Card title="빠른 제어">
      <PlugSection plug={data.plug} mutation={plugMutation} variant="compact" />
      <section className={styles.section}>
        <p className={shared.meta}>에어컨</p>
        <AcControlPanel
          data={data}
          mutation={acMutation}
          showDetails={false}
        />
      </section>
      {data.pc ? (
        <section className={styles.section}>
          <PcQuickActions pc={data.pc} mutation={pcMutation} />
        </section>
      ) : null}
    </Card>
  );
}

function PcQuickActions({
  pc,
  mutation,
}: {
  pc: PcStatus;
  mutation: ReturnType<typeof usePcToggle>;
}) {
  const controllable = isPcControllable(pc);

  return (
    <>
      <p className={shared.meta}>PC (Tapo)</p>
      <OnOffActionButtons
        disabled={!controllable}
        isPending={mutation.isPending}
        pendingAction={mutation.variables}
        onOn={() => requestPcToggle("on", mutation.mutate)}
        onOff={() => requestPcToggle("off", mutation.mutate)}
      />
    </>
  );
}
