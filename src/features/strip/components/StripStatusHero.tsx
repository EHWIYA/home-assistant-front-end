import { Link } from "react-router-dom";
import { paths } from "@/routes/paths";
import powerSvg from "cupertino-icons-svg/svg/power.svg?raw";
import type { CSSProperties } from "react";
import type { StripStateResponse } from "@/api/types";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { ChannelGrid } from "@/components/viz/ChannelGrid";
import { HOME_DOMAIN_THEME } from "@/features/home/utils/homeDomainTheme";
import {
  getStripHomePrimaryStatus,
  getStripHomeSecondaryLine,
  type HomeStatusTone,
} from "@/features/home/utils/homeStatus";
import styles from "./StripStatusHero.module.css";

const theme = HOME_DOMAIN_THEME.strip;

const TONE_DOT: Record<HomeStatusTone, string> = {
  active: theme.accent,
  idle: "#6b7280",
  warn: "#f0ad4e",
  danger: "#e57373",
};

interface StripStatusHeroProps {
  data: StripStateResponse;
  isFetching?: boolean;
}

export function StripStatusHero({ data, isFetching }: StripStatusHeroProps) {
  const primary = getStripHomePrimaryStatus(data, false);

  const dotColor =
    primary.tone === "active" ? theme.accent : TONE_DOT[primary.tone];

  return (
    <section
      className={styles.card}
      style={{ "--strip-accent": theme.accent } as CSSProperties}
      aria-label="멀티탭 상태"
    >
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.iconPill}>
            <CupertinoIcon svg={powerSvg} className="" />
          </span>
          <h2 className={styles.title}>헤이홈 멀티탭</h2>
        </div>
        <Link to={paths.stripSchedules} className={styles.scheduleLink}>
          스케줄 →
        </Link>
      </header>

      <div className={styles.statusRow}>
        <span
          className={styles.dot}
          style={{
            backgroundColor: dotColor,
            boxShadow:
              primary.tone === "active"
                ? `0 0 0 2px ${theme.accentGlow}`
                : undefined,
          }}
          aria-hidden
        />
        <div>
          <p className={styles.statusLabel}>{primary.label}</p>
          <p className={styles.modeSub}>
            {getStripHomeSecondaryLine(data)}
            {isFetching ? " · 갱신 중…" : null}
          </p>
        </div>
      </div>

      <div className={styles.pillRow}>
        <span
          className={`${styles.pill} ${data.online ? styles.pillOk : styles.pillWarn}`.trim()}
        >
          {data.online ? "기기 온라인" : "기기 오프라인"}
        </span>
        <span className={`${styles.pill} ${styles.pillMuted}`}>
          ID {data.device_id}
        </span>
      </div>

      {!data.online ? (
        <p className={styles.bannerOffline}>
          오프라인 — 채널 제어가 실패할 수 있습니다.
        </p>
      ) : null}

      <ChannelGrid
        channels={data.channels}
        accentColor={theme.accent}
        offline={!data.online}
      />
    </section>
  );
}
