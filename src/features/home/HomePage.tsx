import { StatusQueryGate } from "@/components/status/StatusQueryGate";
import { StatusFooter } from "@/components/status/StatusFooter";
import { useStripState } from "@/hooks/useStrip";
import shared from "@/components/status/statusPage.module.css";
import { HomeDomainSummary } from "./components/HomeDomainSummary";
import { HomeQuickControls } from "./components/HomeQuickControls";

export function HomePage() {
  const stripQuery = useStripState();

  return (
    <StatusQueryGate>
      {({ data }) => (
        <div className={shared.page}>
          <HomeDomainSummary
            status={data}
            strip={stripQuery.data ?? null}
            stripLoading={stripQuery.isLoading}
          />
          <HomeQuickControls data={data} />
          <StatusFooter data={data} />
        </div>
      )}
    </StatusQueryGate>
  );
}
