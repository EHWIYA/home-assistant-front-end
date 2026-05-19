import { NavLink, Outlet } from "react-router-dom";
import { isUsingMock } from "@/api/client";
import styles from "./AppShell.module.css";

export function AppShell() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.brand}>Hwiya IoT</h1>
        {isUsingMock() ? (
          <span className={styles.mockBadge}>Mock</span>
        ) : null}
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <nav className={styles.tabBar} aria-label="주요 메뉴">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `${styles.tab} ${isActive ? styles.tabActive : ""}`.trim()
          }
        >
          홈
        </NavLink>
        <NavLink
          to="/sleep"
          className={({ isActive }) =>
            `${styles.tab} ${isActive ? styles.tabActive : ""}`.trim()
          }
        >
          수면
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `${styles.tab} ${isActive ? styles.tabActive : ""}`.trim()
          }
        >
          설정
        </NavLink>
      </nav>
    </div>
  );
}
