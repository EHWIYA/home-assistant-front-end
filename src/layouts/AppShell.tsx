import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { Outlet } from "react-router-dom";
import { AcPushForegroundListener } from "@/components/push/AcPushForegroundListener";
import { PullToRefreshIndicator } from "@/components/pullToRefresh/PullToRefreshIndicator";
import { usePullToRefresh } from "@/components/pullToRefresh/usePullToRefresh";
import { useAppRouteHandle } from "@/routes/handle";
import { AppHeader } from "./AppHeader";
import { MainTabNav } from "./MainTabNav";
import styles from "./AppShell.module.css";

export function AppShell() {
  const { hideTabBar } = useAppRouteHandle();
  const queryClient = useQueryClient();
  const mainRef = useRef<HTMLElement>(null);

  const onRefresh = useCallback(async () => {
    await queryClient.refetchQueries({ type: "active" });
  }, [queryClient]);

  const { pullDistance, isRefreshing, isReady, contentStyle, handlers } =
    usePullToRefresh({
      scrollRef: mainRef,
      onRefresh,
    });

  return (
    <div className={styles.shell}>
      <AcPushForegroundListener />
      <MainTabNav layout="side" />

      <div className={styles.shellBody}>
        <AppHeader />

        <main
          ref={mainRef}
          className={`${styles.main} ${hideTabBar ? styles.mainNoTabBar : ""}`.trim()}
          {...handlers}
        >
          <PullToRefreshIndicator
            pullDistance={pullDistance}
            isRefreshing={isRefreshing}
            isReady={isReady}
          />

          <div className={styles.mainContent} style={contentStyle}>
            <div className={styles.mainInner}>
              <Outlet />
            </div>
          </div>
        </main>

        <MainTabNav layout="bottom" hidden={hideTabBar} />
      </div>
    </div>
  );
}
