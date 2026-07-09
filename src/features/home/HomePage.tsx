import { StatusQueryGate } from "@/components/status/StatusQueryGate";
import { StatusFooter } from "@/components/status/StatusFooter";
import { useStripState } from "@/hooks/useStrip";
import { useMoodMeta, useMoodState } from "@/hooks/useMood";
import shared from "@/components/status/statusPage.module.css";
import homeStyles from "./HomePage.module.css";
import { HomeAlerts } from "./components/HomeAlerts";
import { HomePushAlertCard } from "./components/HomePushAlertCard";
import { HomeClimateHero } from "./components/HomeClimateHero";
import { HomeDomainSummary } from "./components/HomeDomainSummary";
import { HomeOverviewStrip } from "./components/HomeOverviewStrip";

export function HomePage() {
  const stripQuery = useStripState();
  const moodMetaQuery = useMoodMeta();
  const moodStateReadable = moodMetaQuery.data?.state_readable === true;
  const moodStateQuery = useMoodState(moodStateReadable);

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
          <HomePushAlertCard />
          <HomeDomainSummary
            status={data}
            strip={stripQuery.data ?? null}
            stripLoading={stripQuery.isLoading}
            moodMeta={moodMetaQuery.data ?? null}
            moodState={moodStateQuery.data ?? null}
            moodLoading={moodMetaQuery.isLoading || (moodStateReadable && moodStateQuery.isLoading)}
          />
          <StatusFooter data={data} />
        </div>
      )}
    </StatusQueryGate>
  );
}
