import desktopSvg from "cupertino-icons-svg/svg/desktopcomputer.svg?raw";
import snowSvg from "cupertino-icons-svg/svg/snow.svg?raw";
import powerSvg from "cupertino-icons-svg/svg/power.svg?raw";
import type { StatusResponse } from "@/api/types";
import type { StripStateResponse } from "@/api/types";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { useAcState } from "@/hooks/useStatus";
import { HOME_DOMAIN_THEME } from "../utils/homeDomainTheme";
import {
  getAcHomePrimaryStatus,
  getPcHomePrimaryStatus,
  getStripHomePrimaryStatus,
} from "../utils/homeStatus";
import styles from "./HomeOverviewStrip.module.css";

interface HomeOverviewStripProps {
  status: StatusResponse;
  strip: StripStateResponse | null;
  stripLoading: boolean;
}

export function HomeOverviewStrip({
  status,
  strip,
  stripLoading,
}: HomeOverviewStripProps) {
  const acStateQuery = useAcState();
  const ac = getAcHomePrimaryStatus(status, acStateQuery.data);
  const pc = status.pc
    ? getPcHomePrimaryStatus(status.pc)
    : { label: "—", tone: "idle" as const };
  const stripStatus = getStripHomePrimaryStatus(strip, stripLoading);

  return (
    <div className={styles.strip} aria-label="집 요약">
      <OverviewItem
        icon={snowSvg}
        theme={HOME_DOMAIN_THEME.ac}
        label="에어컨"
        status={ac.label}
        tone={ac.tone}
      />
      <span className={styles.divider} aria-hidden />
      <OverviewItem
        icon={desktopSvg}
        theme={HOME_DOMAIN_THEME.pc}
        label="PC"
        status={pc.label}
        tone={pc.tone}
      />
      <span className={styles.divider} aria-hidden />
      <OverviewItem
        icon={powerSvg}
        theme={HOME_DOMAIN_THEME.strip}
        label="멀티탭"
        status={stripStatus.label}
        tone={stripStatus.tone}
      />
    </div>
  );
}

function OverviewItem({
  icon,
  theme,
  label,
  status,
  tone,
}: {
  icon: string;
  theme: (typeof HOME_DOMAIN_THEME)[keyof typeof HOME_DOMAIN_THEME];
  label: string;
  status: string;
  tone: "active" | "idle" | "warn" | "danger";
}) {
  const statusClass =
    tone === "active"
      ? styles.statusActive
      : tone === "warn" || tone === "danger"
        ? styles.statusWarn
        : styles.statusIdle;

  return (
    <div className={styles.item}>
      <span
        className={styles.iconWrap}
        style={{
          backgroundColor: theme.accentSoft,
          color: theme.accent,
        }}
      >
        <CupertinoIcon svg={icon} className="" />
      </span>
      <span
        className={`${styles.dot} ${tone === "active" ? styles.dotActive : styles.dotIdle}`.trim()}
        style={tone === "active" ? { color: theme.accent } : undefined}
        aria-hidden
      />
      <p className={styles.label}>{label}</p>
      <p className={`${styles.status} ${statusClass}`.trim()}>{status}</p>
    </div>
  );
}
