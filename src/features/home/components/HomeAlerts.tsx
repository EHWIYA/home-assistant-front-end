import type { StatusResponse } from "@/api/types";
import type { StripStateResponse } from "@/api/types";
import { useAcState } from "@/hooks/useStatus";
import styles from "./HomeAlerts.module.css";

interface HomeAlertsProps {
  status: StatusResponse;
  strip: StripStateResponse | null;
  stripLoading: boolean;
}

export function HomeAlerts({ status, strip, stripLoading }: HomeAlertsProps) {
  const acStateQuery = useAcState();
  const awayEnabled =
    acStateQuery.data?.away_enabled ?? status.ac_away_enabled ?? false;
  const badges: { key: string; label: string; className: string }[] = [];

  if (awayEnabled) {
    badges.push({
      key: "away",
      label: "외출모드",
      className: styles.badgeInfo,
    });
  }

  if (status.pc && !status.pc.online) {
    badges.push({
      key: "pc-offline",
      label: "PC 오프라인",
      className: styles.badgeDanger,
    });
  }

  if (!stripLoading && strip && !strip.online) {
    badges.push({
      key: "strip-offline",
      label: "멀티탭 오프라인",
      className: styles.badgeDanger,
    });
  }

  if (status.plug.switch === "off") {
    badges.push({
      key: "plug-off",
      label: "플러그 OFF",
      className: styles.badgeWarn,
    });
  }

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className={styles.row} role="status" aria-label="주의 상태">
      {badges.map(({ key, label, className }) => (
        <span key={key} className={`${styles.badge} ${className}`.trim()}>
          {label}
        </span>
      ))}
    </div>
  );
}
