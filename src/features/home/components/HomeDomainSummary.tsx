import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import chevronSvg from "cupertino-icons-svg/svg/chevron_right.svg?raw";
import desktopSvg from "cupertino-icons-svg/svg/desktopcomputer.svg?raw";
import snowSvg from "cupertino-icons-svg/svg/snow.svg?raw";
import powerSvg from "cupertino-icons-svg/svg/power.svg?raw";
import type { AcStateResponse, StatusResponse } from "@/api/types";
import type { StripStateResponse } from "@/api/types";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { ChannelGrid } from "@/components/viz/ChannelGrid";
import { MiniPowerBar } from "@/components/viz/MiniPowerBar";
import { PowerLevelBars } from "@/components/viz/PowerLevelBars";
import { useAcState } from "@/hooks/useStatus";
import { formatPowerW } from "@/utils/power";
import {
  getPowerLevelHeights,
  HOME_DOMAIN_THEME,
  normalizePowerW,
} from "../utils/homeDomainTheme";
import {
  getAcHomePrimaryStatus,
  getAcHomeSecondaryLine,
  getPcHomePrimaryStatus,
  getPcHomeSecondaryLine,
  getStripHomePrimaryStatus,
  getStripHomeSecondaryLine,
  type HomeStatusLine,
  type HomeStatusTone,
} from "../utils/homeStatus";
import styles from "./HomeDomainSummary.module.css";

interface HomeDomainSummaryProps {
  status: StatusResponse;
  strip: StripStateResponse | null;
  stripLoading: boolean;
}

const TONE_DOT: Record<HomeStatusTone, string> = {
  active: HOME_DOMAIN_THEME.ac.accent,
  idle: "#6b7280",
  warn: "#f0ad4e",
  danger: "#e57373",
};

export function HomeDomainSummary({
  status,
  strip,
  stripLoading,
}: HomeDomainSummaryProps) {
  const acStateQuery = useAcState();
  const acPrimary = getAcHomePrimaryStatus(status, acStateQuery.data);
  const acSecondary = getAcHomeSecondaryLine(status);
  const acTheme = HOME_DOMAIN_THEME.ac;
  const pcTheme = HOME_DOMAIN_THEME.pc;
  const stripTheme = HOME_DOMAIN_THEME.strip;
  const acModePill = getAcModePillLabel(acStateQuery.data, status);

  return (
    <div className={styles.grid}>
      <DomainCard
        to="/ac"
        title="에어컨"
        icon={snowSvg}
        theme={acTheme}
        primary={acPrimary}
        secondary={acSecondary}
        modePill={acModePill}
        footer={
          <div className={styles.vizRow}>
            <MiniPowerBar
              value={normalizePowerW(status.plug.power_w)}
              color={acTheme.accent}
              label={`전력 ${formatPowerW(status.plug.power_w)}`}
            />
            <PowerLevelBars
              heights={getPowerLevelHeights(status.plug.power_w)}
              color={acTheme.accent}
            />
          </div>
        }
      />

      {status.pc ? (
        <DomainCard
          to="/pc"
          title="PC"
          icon={desktopSvg}
          theme={pcTheme}
          primary={getPcHomePrimaryStatus(status.pc)}
          secondary={getPcHomeSecondaryLine(status.pc)}
          footer={
            <div className={styles.vizRow}>
              <MiniPowerBar
                value={normalizePowerW(status.pc.power_w)}
                color={pcTheme.accent}
                label={`전력 ${formatPowerW(status.pc.power_w)}`}
              />
              <PowerLevelBars
                heights={getPowerLevelHeights(status.pc.power_w)}
                color={pcTheme.accent}
              />
            </div>
          }
        />
      ) : (
        <DomainCard
          to="/pc"
          title="PC"
          icon={desktopSvg}
          theme={pcTheme}
          primary={{ label: "미연동", tone: "warn" }}
          secondary="Tapo 연동 후 표시"
        />
      )}

      <DomainCard
        to="/strip"
        title="멀티탭"
        icon={powerSvg}
        theme={stripTheme}
        primary={getStripHomePrimaryStatus(strip, stripLoading)}
        secondary={getStripHomeSecondaryLine(strip)}
        footer={
          strip && !stripLoading ? (
            <ChannelGrid
              channels={strip.channels}
              accentColor={stripTheme.accent}
              offline={!strip.online}
            />
          ) : null
        }
      />
    </div>
  );
}

function DomainCard({
  to,
  title,
  icon,
  theme,
  primary,
  secondary,
  modePill,
  footer,
}: {
  to: string;
  title: string;
  icon: string;
  theme: (typeof HOME_DOMAIN_THEME)[keyof typeof HOME_DOMAIN_THEME];
  primary: HomeStatusLine;
  secondary: string;
  modePill?: string;
  footer?: ReactNode;
}) {
  const dotColor =
    primary.tone === "active"
      ? theme.accent
      : TONE_DOT[primary.tone];

  return (
    <Link
      to={to}
      className={styles.link}
      style={
        {
          "--domain-accent": theme.accent,
          "--domain-glow": theme.accentGlow,
        } as CSSProperties
      }
    >
      <article
        className={styles.card}
        style={{ borderLeftColor: theme.accent }}
      >
        <div className={styles.cardInner}>
          <div className={styles.content}>
            <header className={styles.cardHeader}>
              <span
                className={styles.iconPill}
                style={{
                  backgroundColor: theme.accentSoft,
                  color: theme.accent,
                }}
              >
                <CupertinoIcon svg={icon} className="" />
              </span>
              <h2 className={styles.cardTitle}>{title}</h2>
              <CupertinoIcon svg={chevronSvg} className={styles.chevron} />
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
              <p className={styles.statusLabel}>{primary.label}</p>
              {modePill ? (
                <span
                  className={styles.modePill}
                  style={{
                    color: theme.accent,
                    backgroundColor: theme.accentSoft,
                  }}
                >
                  {modePill}
                </span>
              ) : null}
            </div>

            <p className={styles.sub}>{secondary}</p>
            {footer}
          </div>

          <div className={styles.watermark} style={{ color: theme.accent }}>
            <CupertinoIcon svg={icon} className="" />
          </div>
        </div>
      </article>
    </Link>
  );
}

function getAcModePillLabel(
  acState: AcStateResponse | undefined,
  status: StatusResponse,
): string | undefined {
  const primary = getAcHomePrimaryStatus(status, acState);
  if (primary.tone !== "active") {
    return undefined;
  }
  const mode = acState?.mode ?? status.ac_mode ?? "off";
  if (mode === "cool") return "냉방";
  if (mode === "dry") return "제습";
  if (mode === "auto") return "자동";
  return undefined;
}
