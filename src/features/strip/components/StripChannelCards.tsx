import type { CSSProperties } from "react";
import type { StripChannel, StripChannelNumber } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import { HOME_DOMAIN_THEME } from "@/features/home/utils/homeDomainTheme";
import { useMutationErrorToast } from "@/hooks/useMutationErrorToast";
import { TOAST_DEVICE, TOAST_GUIDE } from "@/utils/toastMessages";
import styles from "./StripChannelCards.module.css";

const theme = HOME_DOMAIN_THEME.strip;

function channelLabel(ch: StripChannel): string {
  return ch.label?.trim() || `채널 ${ch.channel}`;
}

function channelStateText(on: boolean | null): string {
  if (on === true) return "ON";
  if (on === false) return "OFF";
  return "알 수 없음";
}

interface StripChannelCardsProps {
  channels: StripChannel[];
  deviceOnline: boolean;
  mutation: UseMutationResult<
    unknown,
    Error,
    { channel: StripChannelNumber; on: boolean },
    unknown
  >;
}

export function StripChannelCards({
  channels,
  deviceOnline,
  mutation,
}: StripChannelCardsProps) {
  useMutationErrorToast(
    mutation,
    TOAST_DEVICE.strip,
    TOAST_GUIDE.retry,
    "control",
  );

  const sorted = [...channels].sort((a, b) => a.channel - b.channel);

  return (
    <section
      className={styles.card}
      style={{ "--strip-accent": theme.accent } as CSSProperties}
      aria-label="멀티탭 채널 제어"
    >
      <h2 className={styles.title}>채널 제어</h2>
      <div className={styles.grid}>
        {sorted.map((ch) => (
          <ChannelTile
            key={ch.channel}
            channel={ch}
            deviceOnline={deviceOnline}
            pending={
              mutation.isPending &&
              mutation.variables?.channel === ch.channel
            }
            hasError={
              mutation.isError &&
              mutation.variables?.channel === ch.channel
            }
            onToggle={(on) =>
              mutation.mutate({
                channel: ch.channel as StripChannelNumber,
                on,
              })
            }
          />
        ))}
      </div>
    </section>
  );
}

interface ChannelTileProps {
  channel: StripChannel;
  deviceOnline: boolean;
  pending: boolean;
  hasError: boolean;
  onToggle: (on: boolean) => void;
}

function ChannelTile({
  channel,
  deviceOnline,
  pending,
  hasError,
  onToggle,
}: ChannelTileProps) {
  const canToggle = channel.on !== null && deviceOnline;
  const isOn = channel.on === true;
  const nextOn = !isOn;

  return (
    <article
      className={`${styles.tile} ${isOn ? styles.tileOn : styles.tileOff}`.trim()}
    >
      <p className={styles.channelNum}>CH {channel.channel}</p>
      <p className={styles.channelTitle}>{channelLabel(channel)}</p>
      <p
        className={`${styles.channelState} ${
          isOn
            ? styles.stateOn
            : channel.on === false
              ? styles.stateOff
              : styles.stateUnknown
        }`.trim()}
      >
        {channelStateText(channel.on)}
      </p>
      {hasError ? <p className={styles.errorDetail}>제어 실패</p> : null}
      <button
        type="button"
        className={`${styles.toggleBtn} ${isOn ? styles.toggleBtnOn : styles.toggleBtnOff}`.trim()}
        disabled={!canToggle || pending}
        aria-pressed={isOn}
        onClick={() => onToggle(nextOn)}
      >
        {pending ? "처리 중…" : isOn ? "끄기" : "켜기"}
      </button>
    </article>
  );
}
