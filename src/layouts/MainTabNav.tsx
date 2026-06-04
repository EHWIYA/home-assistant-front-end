import houseFillSvg from "cupertino-icons-svg/svg/house_fill.svg?raw";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { BRAND } from "@/config/brand";
import { MAIN_TABS } from "@/routes/tabs";
import { handleMainTabClick } from "@/layouts/mainTabNavUtils";
import styles from "./MainTabNav.module.css";

type MainTabNavLayout = "bottom" | "side";

interface MainTabNavProps {
  layout: MainTabNavLayout;
  /** 하단 탭 숨김(스케줄 폼 등) — side 레이아웃은 항상 표시 */
  hidden?: boolean;
}

export function MainTabNav({ layout, hidden }: MainTabNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  if (hidden && layout === "bottom") {
    return null;
  }

  if (layout === "side") {
    return (
      <nav
        className={styles.side}
        aria-label="주요 메뉴"
        data-layout="side"
      >
        <div className={styles.sideBrand}>
          <div className={styles.sideLogo} aria-hidden>
            <CupertinoIcon
              svg={houseFillSvg}
              className={styles.sideLogoIcon}
            />
          </div>
          <div className={styles.sideBrandText}>
            <p className={styles.sideBrandName}>
              <span className={styles.sideBrandPrimary}>
                {BRAND.wordPrimary}
              </span>
              <span className={styles.sideBrandAccent}>{BRAND.wordAccent}</span>
            </p>
          </div>
        </div>
        <div className={styles.sideLinks}>
          {MAIN_TABS.map(({ id, to, label, icon, iconActive, end }) => (
            <NavLink
              key={id}
              to={to}
              end={end}
              replace
              onClick={(event) =>
                handleMainTabClick(
                  { id, to, label, icon, iconActive, end },
                  location.pathname,
                  navigate,
                  event,
                )
              }
              className={({ isActive }) =>
                `${styles.sideLink} ${isActive ? styles.sideLinkActive : ""}`.trim()
              }
            >
              {({ isActive }) => (
                <>
                  <CupertinoIcon
                    svg={isActive && iconActive ? iconActive : icon}
                    className={styles.sideIcon}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav
      className={styles.bottom}
      aria-label="주요 메뉴"
      data-layout="bottom"
    >
      {MAIN_TABS.map(({ id, to, label, icon, iconActive, end }) => (
        <NavLink
          key={id}
          to={to}
          end={end}
          replace
          onClick={(event) =>
            handleMainTabClick(
              { id, to, label, icon, iconActive, end },
              location.pathname,
              navigate,
              event,
            )
          }
          className={({ isActive }) =>
            `${styles.bottomLink} ${isActive ? styles.bottomLinkActive : ""}`.trim()
          }
        >
          {({ isActive }) => (
            <>
              <CupertinoIcon
                svg={isActive && iconActive ? iconActive : icon}
                className={styles.icon}
              />
              <span className={styles.bottomLabel}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
