import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import {
  HOME_DOMAIN_THEME,
  type HomeDomainKey,
} from "@/features/home/utils/homeDomainTheme";
import { MAIN_TABS, type MainTabId } from "@/routes/tabs";
import styles from "./SettingsQuickLinksPanel.module.css";

const TAB_THEME: Record<Exclude<MainTabId, "settings">, HomeDomainKey> = {
  pc: "pc",
  ac: "ac",
  home: "home",
  strip: "strip",
};

const TAB_DESC: Record<Exclude<MainTabId, "settings">, string> = {
  pc: "전력·콘센트",
  ac: "냉방·플러그",
  home: "한눈에 보기",
  strip: "4구·스케줄",
};

export function SettingsQuickLinksPanel() {
  const links = MAIN_TABS.filter((t) => t.id !== "settings");

  return (
    <section className={styles.card} aria-label="바로가기">
      <h2 className={styles.title}>바로가기</h2>
      <div className={styles.grid}>
        {links.map((tab) => {
          const themeKey = TAB_THEME[tab.id as Exclude<MainTabId, "settings">];
          const theme = HOME_DOMAIN_THEME[themeKey];
          const desc = TAB_DESC[tab.id as Exclude<MainTabId, "settings">];
          return (
            <Link
              key={tab.id}
              to={tab.to}
              className={styles.tile}
              style={
                {
                  "--tile-accent": theme.accent,
                  "--tile-soft": theme.accentSoft,
                } as CSSProperties
              }
            >
              <span className={styles.iconPill}>
                <CupertinoIcon svg={tab.icon} className="" />
              </span>
              <span className={styles.tileLabel}>{tab.label}</span>
              <span className={styles.tileDesc}>{desc}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
