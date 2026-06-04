import gearSvg from "cupertino-icons-svg/svg/gear.svg?raw";
import type { CSSProperties } from "react";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { BRAND } from "@/config/brand";
import { HOME_DOMAIN_THEME } from "@/features/home/utils/homeDomainTheme";
import styles from "./SettingsStatusHero.module.css";

const theme = HOME_DOMAIN_THEME.settings;

export function SettingsStatusHero() {
  return (
    <section
      className={styles.card}
      style={{ "--settings-accent": theme.accent } as CSSProperties}
      aria-label="설정"
    >
      <header className={styles.header}>
        <span className={styles.iconPill}>
          <CupertinoIcon svg={gearSvg} className="" />
        </span>
        <h2 className={styles.title}>설정 · {BRAND.name}</h2>
      </header>

      <p className={styles.tagline}>{BRAND.tagline}</p>
    </section>
  );
}
