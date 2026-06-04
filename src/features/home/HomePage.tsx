import { StatusQueryGate } from "@/components/status/StatusQueryGate";
import { StatusFooter } from "@/components/status/StatusFooter";
import { useStripState } from "@/hooks/useStrip";
import shared from "@/components/status/statusPage.module.css";
import homeStyles from "./HomePage.module.css";
import { HomeAlerts } from "./components/HomeAlerts";
import { HomeClimateHero } from "./components/HomeClimateHero";
import { HomeDomainSummary } from "./components/HomeDomainSummary";
import { HomeOverviewStrip } from "./components/HomeOverviewStrip";

export function HomePage() {
  const stripQuery = useStripState();

  return (
    <StatusQueryGate>
      {({ data }) => (
        <div className={shared.page}>
          <div className={homeStyles.top}>
            <HomeClimateHero indoor={data.indoor} />
            <HomeOverviewStrip
              status={data}
              strip={stripQuery.data ?? null}
              stripLoading={stripQuery.isLoading}
            />
          </div>
          <HomeAlerts
            status={data}
            strip={stripQuery.data ?? null}
            stripLoading={stripQuery.isLoading}
          />
          <HomeDomainSummary
            status={data}
            strip={stripQuery.data ?? null}
            stripLoading={stripQuery.isLoading}
          />
          <StatusFooter data={data} />
        </div>
      )}
    </StatusQueryGate>
  );
}
