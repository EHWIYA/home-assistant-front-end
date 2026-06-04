import { Outlet } from "react-router-dom";
import { useAppRouteHandle } from "@/routes/handle";
import { AppHeader } from "./AppHeader";
import { MainTabNav } from "./MainTabNav";
import styles from "./AppShell.module.css";

export function AppShell() {
  const { hideTabBar } = useAppRouteHandle();

  return (
    <div className={styles.shell}>
      <MainTabNav layout="side" />

      <div className={styles.shellBody}>
        <AppHeader />

        <main
          className={`${styles.main} ${hideTabBar ? styles.mainNoTabBar : ""}`.trim()}
        >
          <div className={styles.mainInner}>
            <Outlet />
          </div>
        </main>

        <MainTabNav layout="bottom" hidden={hideTabBar} />
      </div>
    </div>
  );
}
