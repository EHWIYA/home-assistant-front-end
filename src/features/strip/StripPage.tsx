import { Link } from "react-router-dom";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { StripChannel, StripChannelNumber } from "@/api/types";
import { useStripChannelToggle, useStripState } from "@/hooks/useStrip";
import { useMutationErrorToast } from "@/hooks/useMutationErrorToast";
import { useQueryErrorToast } from "@/hooks/useQueryErrorToast";
import { formatUpdatedAt } from "@/utils/date";
import {
  TOAST_DEVICE,
  TOAST_GUIDE,
  TOAST_RESOURCE,
} from "@/utils/toastMessages";
import styles from "./StripPage.module.css";

function channelLabel(ch: StripChannel): string {
  return ch.label?.trim() || `채널 ${ch.channel}`;
}

function channelStateText(on: boolean | null): string {
  if (on === true) return "ON";
  if (on === false) return "OFF";
  return "알 수 없음";
}

function channelStateClass(on: boolean | null): string {
  if (on === true) return styles.stateOn;
  if (on === false) return styles.stateOff;
  return styles.stateUnknown;
}

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
  useMutationErrorToast(
    channelMutation,
    TOAST_DEVICE.strip,
    TOAST_GUIDE.retry,
    "control",
  );

  if (isLoading) {
    return <p className={styles.message}>멀티탭 상태 불러오는 중…</p>;
  }

  if (isError || !data) {
    return (
      <div className={styles.offline}>
        <p className={styles.message}>멀티탭에 연결할 수 없습니다</p>
        <p className={styles.hint}>Tailscale·API 주소·API 키를 확인하세요.</p>
        <p className={styles.errorDetail}>멀티탭 상태 조회 실패</p>
        <Button onClick={() => void refetch()}>다시 시도</Button>
      </div>
    );
  }

  const sorted = [...data.channels].sort((a, b) => a.channel - b.channel);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Link to="/strip/schedules" className={styles.link}>
          스케줄 관리 →
        </Link>
      </div>

      {!data.online ? (
        <p className={`${styles.banner} ${styles.bannerOffline}`}>
          기기가 오프라인입니다. 제어가 실패할 수 있습니다.
        </p>
      ) : (
        <p className={`${styles.banner} ${styles.bannerOk}`}>기기 온라인</p>
      )}

      <Card title="헤이홈 멀티탭 (4구)">
        <p className={styles.deviceMeta}>
          기기 ID: {data.device_id}
          {isFetching ? " · 갱신 중…" : null}
        </p>
        <ul className={styles.channelList}>
          {sorted.map((ch) => (
            <ChannelRow
              key={ch.channel}
              channel={ch}
              deviceOnline={data.online}
              pending={
                channelMutation.isPending &&
                channelMutation.variables?.channel === ch.channel
              }
              mutationError={
                channelMutation.isError &&
                channelMutation.variables?.channel === ch.channel
                  ? true
                  : null
              }
              onToggle={(on) =>
                channelMutation.mutate({
                  channel: ch.channel as StripChannelNumber,
                  on,
                })
              }
            />
          ))}
        </ul>
      </Card>

      <p className={styles.updated}>
        갱신: {formatUpdatedAt(data.updated_at)}
      </p>
    </div>
  );
}

interface ChannelRowProps {
  channel: StripChannel;
  deviceOnline: boolean;
  pending: boolean;
  mutationError: boolean | null;
  onToggle: (on: boolean) => void;
}

function ChannelRow({
  channel,
  deviceOnline,
  pending,
  mutationError,
  onToggle,
}: ChannelRowProps) {
  const canToggle = channel.on !== null && deviceOnline;
  const isOn = channel.on === true;
  const nextOn = !isOn;

  return (
    <li className={styles.channelRow}>
      <div className={styles.channelInfo}>
        <p className={styles.channelTitle}>{channelLabel(channel)}</p>
        <p className={`${styles.channelMeta} ${channelStateClass(channel.on)}`}>
          {channelStateText(channel.on)}
        </p>
        {mutationError ? <p className={styles.errorDetail}>제어 실패</p> : null}
      </div>
      <Button
        variant={isOn ? "danger" : "primary"}
        disabled={!canToggle || pending}
        onClick={() => onToggle(nextOn)}
      >
        {pending ? "처리 중…" : isOn ? "끄기" : "켜기"}
      </Button>
    </li>
  );
}
