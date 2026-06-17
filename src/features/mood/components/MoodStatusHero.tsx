import type { CSSProperties } from "react";
import moonSvg from "cupertino-icons-svg/svg/moon_fill.svg?raw";
import type { MoodMetaResponse, MoodStateResponse } from "@/api/types";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { HOME_DOMAIN_THEME } from "@/features/home/utils/homeDomainTheme";
import { formatMoodStateSubline, getMoodStateHex } from "@/utils/moodColors";
import styles from "./MoodStatusHero.module.css";

const theme = HOME_DOMAIN_THEME.mood;

interface MoodStatusHeroProps {
  meta: MoodMetaResponse;
  state?: MoodStateResponse;
  stateLoading?: boolean;
}

export function MoodStatusHero({
  meta,
  state,
  stateLoading = false,
}: MoodStatusHeroProps) {
  const stateReadable = meta.state_readable;
  const showLiveState = stateReadable && state != null;
  const statusLabel = showLiveState
    ? state.on
      ? "켜짐"
      : "꺼짐"
    : stateReadable && stateLoading
      ? "불러오는 중…"
      : "—";
  const modeSub = showLiveState ? formatMoodStateSubline(state) : null;
  const dotColor =
    showLiveState && state.on
      ? getMoodStateHex(state) ?? theme.accent
      : theme.accent;

  return (
    <section
      className={styles.card}
      style={{ "--mood-accent": theme.accent } as CSSProperties}
      aria-label="무드등 상태"
    >
      <header className={styles.header}>
        <span className={styles.iconPill}>
          <CupertinoIcon svg={moonSvg} className="" />
        </span>
        <h2 className={styles.title}>
          {meta.room} {meta.device}
        </h2>
      </header>

      <div className={styles.statusRow}>
        <span
          className={styles.dot}
          style={{
            backgroundColor: dotColor,
            boxShadow: `0 0 0 2px ${theme.accentGlow}`,
          }}
          aria-hidden
        />
        <div>
          <p className={styles.statusLabel}>{statusLabel}</p>
          {modeSub ? <p className={styles.modeSub}>{modeSub}</p> : null}
        </div>
      </div>
    </section>
  );
}
