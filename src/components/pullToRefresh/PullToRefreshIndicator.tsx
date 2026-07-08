import arrowDownSvg from "cupertino-icons-svg/svg/arrow_down.svg?raw";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import styles from "./PullToRefresh.module.css";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  isReady: boolean;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  isReady,
}: PullToRefreshIndicatorProps) {
  const visible = pullDistance > 0 || isRefreshing;
  if (!visible) {
    return null;
  }

  const progress = Math.min(1, pullDistance / 72);

  return (
    <div
      className={styles.indicator}
      style={{ height: pullDistance }}
      aria-live="polite"
      aria-busy={isRefreshing}
    >
      <div
        className={styles.indicatorInner}
        style={{ opacity: Math.max(0.35, progress) }}
      >
        {isRefreshing ? (
          <span className={styles.spinner} aria-hidden />
        ) : (
          <CupertinoIcon
            svg={arrowDownSvg}
            className={`${styles.arrow} ${isReady ? styles.arrowReady : ""}`.trim()}
          />
        )}
        <span className={styles.label}>
          {isRefreshing ? "새로고침 중" : isReady ? "놓으면 새로고침" : "당겨서 새로고침"}
        </span>
      </div>
    </div>
  );
}
