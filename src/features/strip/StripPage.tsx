import { Button } from "@/components/Button";
import { useStripChannelToggle, useStripState } from "@/hooks/useStrip";
import { useQueryErrorToast } from "@/hooks/useQueryErrorToast";
import shared from "@/components/status/statusPage.module.css";
import { formatUpdatedAt } from "@/utils/date";
import {
  TOAST_GUIDE,
  TOAST_RESOURCE,
} from "@/utils/toastMessages";
import { StripChannelCards } from "./components/StripChannelCards";
import { StripStatusHero } from "./components/StripStatusHero";

export function StripPage() {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useStripState();
  const channelMutation = useStripChannelToggle();

  useQueryErrorToast({
    isError,
    error,
    resourceLabel: TOAST_RESOURCE.stripStatus,
    actionGuide: TOAST_GUIDE.checkNetworkAndApi,
  });

  if (isLoading) {
    return <p className={shared.message}>멀티탭 상태 불러오는 중…</p>;
  }

  if (isError || !data) {
    return (
      <div className={shared.offline}>
        <p className={shared.message}>멀티탭에 연결할 수 없습니다</p>
        <p className={shared.hint}>Tailscale·API 주소·API 키를 확인하세요.</p>
        <p className={shared.errorDetail}>멀티탭 상태 조회 실패</p>
        <Button onClick={() => void refetch()}>다시 시도</Button>
      </div>
    );
  }

  return (
    <div className={shared.page}>
      <StripStatusHero data={data} isFetching={isFetching} />
      <StripChannelCards
        channels={data.channels}
        deviceOnline={data.online}
        mutation={channelMutation}
      />
      <p className={shared.updated}>
        갱신: {formatUpdatedAt(data.updated_at)}
      </p>
    </div>
  );
}
