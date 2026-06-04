import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { useAppRouteHandle } from "@/routes/handle";
import { MAIN_TABS, type MainTabConfig } from "@/routes/tabs";
import { AppHeader } from "./AppHeader";
import styles from "./AppShell.module.css";

function isTabRootPath(tab: MainTabConfig, pathname: string): boolean {
  if (tab.to === "/") {
    return pathname === "/";
  }
  return pathname === tab.to;
}

/** 탭 전환은 replace — 브라우저 뒤로가기가 탭 이동을 되돌리지 않음 */
function handleTabClick(
  tab: MainTabConfig,
  pathname: string,
  navigate: ReturnType<typeof useNavigate>,
  event: React.MouseEvent<HTMLAnchorElement>,
) {
  if (isTabRootPath(tab, pathname)) {
    return;
  }
  const onTabBranch =
    tab.to === "/"
      ? false
      : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
  if (!onTabBranch) {
    return;
  }
  event.preventDefault();
  void navigate(tab.to, { replace: true });
}

export function AppShell() {
  const { hideTabBar } = useAppRouteHandle();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className={styles.shell}>
      <AppHeader />

      <main
        className={`${styles.main} ${hideTabBar ? styles.mainNoTabBar : ""}`.trim()}
      >
        <Outlet />
      </main>

      {hideTabBar ? null : (
        <nav className={styles.tabBar} aria-label="주요 메뉴">
          {MAIN_TABS.map(({ id, to, label, icon, iconActive, end }) => (
            <NavLink
              key={id}
              to={to}
              end={end}
              replace
              onClick={(event) =>
                handleTabClick(
                  { id, to, label, icon, iconActive, end },
                  location.pathname,
                  navigate,
                  event,
                )
              }
              className={({ isActive }) =>
                `${styles.tab} ${isActive ? styles.tabActive : ""}`.trim()
              }
            >
              {({ isActive }) => (
                <>
                  <CupertinoIcon
                    svg={isActive && iconActive ? iconActive : icon}
                    className={styles.tabIcon}
                  />
                  <span className={styles.tabLabel}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
