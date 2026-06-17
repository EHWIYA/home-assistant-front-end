import { Button } from "@/components/Button";
import shared from "@/components/status/statusPage.module.css";
import {
  useMoodBrightness,
  useMoodCapabilities,
  useMoodColorHs,
  useMoodColorRgb,
  useMoodColorTemperature,
  useMoodMeta,
  useMoodPower,
  useMoodState,
} from "@/hooks/useMood";
import { useQueryErrorToast } from "@/hooks/useQueryErrorToast";
import { TOAST_GUIDE, TOAST_RESOURCE } from "@/utils/toastMessages";
import { MoodControlPanel } from "./components/MoodControlPanel";
import { MoodStatusHero } from "./components/MoodStatusHero";

export function MoodPage() {
  const metaQuery = useMoodMeta();
  const capabilitiesQuery = useMoodCapabilities();
  const stateReadable = metaQuery.data?.state_readable === true;
  const stateQuery = useMoodState(stateReadable);
  const powerMutation = useMoodPower();
  const brightnessMutation = useMoodBrightness();
  const colorHsMutation = useMoodColorHs();
  const colorRgbMutation = useMoodColorRgb();
  const colorTemperatureMutation = useMoodColorTemperature();

  const isLoading = metaQuery.isLoading || capabilitiesQuery.isLoading;
  const isError =
    metaQuery.isError ||
    capabilitiesQuery.isError ||
    (stateReadable && stateQuery.isError);
  const error =
    metaQuery.error ?? capabilitiesQuery.error ?? stateQuery.error;

  useQueryErrorToast({
    isError: metaQuery.isError,
    error: metaQuery.error,
    resourceLabel: TOAST_RESOURCE.moodMeta,
    actionGuide: TOAST_GUIDE.checkNetworkAndApi,
  });
  useQueryErrorToast({
    isError: capabilitiesQuery.isError,
    error: capabilitiesQuery.error,
    resourceLabel: TOAST_RESOURCE.moodCapabilities,
    actionGuide: TOAST_GUIDE.checkNetworkAndApi,
  });
  useQueryErrorToast({
    isError: stateReadable && stateQuery.isError,
    error: stateQuery.error,
    resourceLabel: TOAST_RESOURCE.moodState,
    actionGuide: TOAST_GUIDE.checkNetworkAndApi,
  });

  if (isLoading) {
    return <p className={shared.message}>무드등 정보 불러오는 중…</p>;
  }

  if (isError || !metaQuery.data || !capabilitiesQuery.data) {
    return (
      <div className={shared.offline}>
        <p className={shared.message}>무드등에 연결할 수 없습니다</p>
        <p className={shared.hint}>Tailscale·API 주소·API 키를 확인하세요.</p>
        <p className={shared.errorDetail}>
          {error instanceof Error ? error.message : "무드등 정보 조회 실패"}
        </p>
        <Button
          onClick={() => {
            void metaQuery.refetch();
            void capabilitiesQuery.refetch();
            if (stateReadable) {
              void stateQuery.refetch();
            }
          }}
        >
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className={shared.page}>
      <div className={shared.pageSplitDesktopOnly}>
        <MoodStatusHero
          meta={metaQuery.data}
          state={stateQuery.data}
          stateLoading={stateReadable && stateQuery.isLoading}
        />
        <MoodControlPanel
          meta={metaQuery.data}
          capabilities={capabilitiesQuery.data}
          state={stateQuery.data}
          powerMutation={powerMutation}
          brightnessMutation={brightnessMutation}
          colorHsMutation={colorHsMutation}
          colorRgbMutation={colorRgbMutation}
          colorTemperatureMutation={colorTemperatureMutation}
        />
      </div>
    </div>
  );
}
