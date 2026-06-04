import type { StripChannel } from "@/api/types";
import styles from "./ChannelGrid.module.css";

interface ChannelGridProps {
  channels: StripChannel[];
  accentColor: string;
  offline?: boolean;
}

export function ChannelGrid({
  channels,
  accentColor,
  offline = false,
}: ChannelGridProps) {
  const sorted = [...channels].sort((a, b) => a.channel - b.channel);

  return (
    <div className={styles.grid} role="img" aria-label="멀티탭 채널 상태">
      {sorted.map((ch) => {
        const on = ch.on === true;
        return (
          <div key={ch.channel} className={styles.cell}>
            <span
              className={`${styles.dot} ${on ? styles.dotOn : styles.dotOff}`.trim()}
              style={
                on && !offline
                  ? {
                      backgroundColor: accentColor,
                      boxShadow: `0 0 10px ${accentColor}66`,
                    }
                  : undefined
              }
            />
            <span className={styles.num}>{ch.channel}</span>
          </div>
        );
      })}
    </div>
  );
}
