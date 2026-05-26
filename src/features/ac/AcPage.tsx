import { StatusQueryGate } from "@/components/status/StatusQueryGate";
import { StatusFooter } from "@/components/status/StatusFooter";
import { ClimateSection } from "@/components/status/ClimateSection";
import { useAcControl, usePlugToggle } from "@/hooks/useStatus";
import shared from "@/components/status/statusPage.module.css";
import { AcControlCard } from "./components/AcControlCard";
import { PlugSection } from "./components/PlugSection";
import { SleepSection } from "./components/SleepSection";

export function AcPage() {
  const plugMutation = usePlugToggle();
  const acMutation = useAcControl();

  return (
    <StatusQueryGate loadingMessage="에어컨 상태 불러오는 중…">
      {({ data }) => {
        const plugOn = data.plug.switch === "on";

        return (
          <div className={shared.page}>
            <PlugSection
              plug={data.plug}
              mutation={plugMutation}
              variant="full"
            />
            <ClimateSection
              indoor={data.indoor}
              weatherOutdoor={data.weather_outdoor}
              combined
            />
            <AcControlCard
              data={data}
              acControlEnabled={plugOn}
              mutation={acMutation}
            />
            <SleepSection />
            <StatusFooter data={data} />
          </div>
        );
      }}
    </StatusQueryGate>
  );
}
