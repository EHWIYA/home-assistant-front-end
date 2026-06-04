import desktopSvg from "cupertino-icons-svg/svg/desktopcomputer.svg?raw";
import type { CSSProperties } from "react";
import type { PcStatus } from "@/api/types";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { MiniPowerBar } from "@/components/viz/MiniPowerBar";
import { PowerLevelBars } from "@/components/viz/PowerLevelBars";
import {
  getPowerLevelHeights,
  HOME_DOMAIN_THEME,
  normalizePowerW,
} from "@/features/home/utils/homeDomainTheme";
import {
  getPcHomePrimaryStatus,
  getPcHomeSecondaryLine,
  type HomeStatusTone,
} from "@/features/home/utils/homeStatus";
import { getPcStatusLabel } from "@/utils/pcStatus";
import { formatPowerW } from "@/utils/power";
import styles from "./PcStatusHero.module.css";

const theme = HOME_DOMAIN_THEME.pc;

const TONE_DOT: Record<HomeStatusTone, string> = {
  active: theme.accent,
  idle: "#6b7280",
  warn: "#f0ad4e",
  danger: "#e57373",
};

interface PcStatusHeroProps {
  pc: PcStatus;
}

export function PcStatusHero({ pc }: PcStatusHeroProps) {
  const primary = getPcHomePrimaryStatus(pc);
  const dotColor =
    primary.tone === "active" ? theme.accent : TONE_DOT[primary.tone];

  return (
    <section
      className={styles.card}
      style={{ "--pc-accent": theme.accent } as CSSProperties}
      aria-label="PC 상태"
    >
      <header className={styles.header}>
        <span className={styles.iconPill}>
          <CupertinoIcon svg={desktopSvg} className="" />
        </span>
        <h2 className={styles.title}>PC · HWIYA-PC</h2>
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
          <p className={styles.modeSub}>{getPcHomeSecondaryLine(pc)}</p>
        </div>
      </div>

      <div className={styles.pillRow}>
        <span
          className={`${styles.pill} ${pc.online ? styles.pillOk : styles.pillWarn}`.trim()}
        >
          {pc.online ? "온라인" : "오프라인"}
        </span>
        <span className={`${styles.pill} ${styles.pillMuted}`}>
          {getPcStatusLabel(pc)}
        </span>
        {pc.overload ? (
          <span className={`${styles.pill} ${styles.pillWarn}`}>과부하</span>
        ) : null}
        {pc.wifi_signal_level > 0 ? (
          <span className={`${styles.pill} ${styles.pillMuted}`}>
            Wi‑Fi {pc.wifi_signal_level}
          </span>
        ) : null}
      </div>

      <div className={styles.powerSection}>
        <p className={styles.powerValue}>{formatPowerW(pc.power_w)}</p>
        <div className={styles.vizRow}>
          <MiniPowerBar
            value={normalizePowerW(pc.power_w)}
            color={theme.accent}
            label="실시간 전력"
          />
          <PowerLevelBars
            heights={getPowerLevelHeights(pc.power_w)}
            color={theme.accent}
          />
        </div>
        {pc.estimated_running ? (
          <p className={styles.powerHint}>50W 이상 — PC 동작으로 추정</p>
        ) : pc.switch === "on" ? (
          <p className={styles.powerHint}>콘센트 ON · 대기·꺼짐일 수 있음</p>
        ) : null}
      </div>
    </section>
  );
}
