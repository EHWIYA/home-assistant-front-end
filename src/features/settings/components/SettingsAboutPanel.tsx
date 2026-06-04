import type { CSSProperties } from "react";
import { BRAND } from "@/config/brand";
import { APP_VERSION } from "@/config/appMeta";
import { HOME_DOMAIN_THEME } from "@/features/home/utils/homeDomainTheme";
import styles from "./SettingsAboutPanel.module.css";

const theme = HOME_DOMAIN_THEME.settings;

export function SettingsAboutPanel() {
  return (
    <section
      className={styles.card}
      style={{ "--settings-accent": theme.accent } as CSSProperties}
      aria-label="앱 정보"
    >
      <p className={styles.name}>{BRAND.name}</p>
      <p className={styles.desc}>
        휘야 집 IoT — PC·에어컨·멀티탭을 한곳에서 확인하고 제어합니다.
      </p>
      <p className={styles.version}>버전 {APP_VERSION}</p>
    </section>
  );
}
