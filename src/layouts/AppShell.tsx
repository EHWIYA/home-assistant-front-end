import { NavLink, Outlet } from "react-router-dom";
import desktopSvg from "cupertino-icons-svg/svg/desktopcomputer.svg?raw";
import snowSvg from "cupertino-icons-svg/svg/snow.svg?raw";
import houseSvg from "cupertino-icons-svg/svg/house.svg?raw";
import houseFillSvg from "cupertino-icons-svg/svg/house_fill.svg?raw";
import powerSvg from "cupertino-icons-svg/svg/power.svg?raw";
import gearSvg from "cupertino-icons-svg/svg/gear.svg?raw";
import gearFillSvg from "cupertino-icons-svg/svg/gear_alt_fill.svg?raw";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { AppHeader } from "./AppHeader";
import styles from "./AppShell.module.css";

type AppTab = {
  to: string;
  label: string;
  icon: string;
  iconActive?: string;
  end?: boolean;
};

const tabs: AppTab[] = [
  { to: "/pc", label: "PC", icon: desktopSvg },
  { to: "/ac", label: "에어컨", icon: snowSvg },
  { to: "/", label: "홈", icon: houseSvg, iconActive: houseFillSvg, end: true },
  { to: "/strip", label: "멀티탭", icon: powerSvg, end: false },
  {
    to: "/settings",
    label: "설정",
    icon: gearSvg,
    iconActive: gearFillSvg,
  },
];

export function AppShell() {
  return (
    <div className={styles.shell}>
      <AppHeader />

      <main className={styles.main}>
        <Outlet />
      </main>

      <nav className={styles.tabBar} aria-label="주요 메뉴">
        {tabs.map(({ to, label, icon, iconActive, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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
    </div>
  );
}
