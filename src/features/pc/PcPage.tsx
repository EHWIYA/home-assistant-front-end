import { StatusQueryGate } from "@/components/status/StatusQueryGate";
import { StatusFooter } from "@/components/status/StatusFooter";
import { usePcToggle } from "@/hooks/useStatus";
import shared from "@/components/status/statusPage.module.css";
import { PcControlPanel } from "./components/PcControlPanel";

export function PcPage() {
  const pcMutation = usePcToggle();

  return (
    <StatusQueryGate loadingMessage="PC 상태 불러오는 중…">
      {({ data }) => (
        <div className={shared.page}>
          {data.pc ? (
            <PcControlPanel pc={data.pc} mutation={pcMutation} />
          ) : (
            <p className={shared.message}>
              PC(Tapo) 정보가 API 응답에 없습니다. 백엔드·OpenAPI 버전을
              확인하세요.
            </p>
          )}
          <StatusFooter data={data} />
        </div>
      )}
    </StatusQueryGate>
  );
}
