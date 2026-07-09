import houseFillSvg from "cupertino-icons-svg/svg/house_fill.svg?raw";
import { isUsingMock } from "@/api/client";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { BRAND } from "@/config/brand";
import { useAppRouteHandle } from "@/routes/handle";
import { AppHeaderAlertButton } from "./AppHeaderAlertButton";
import styles from "./AppHeader.module.css";

export function AppHeader() {
  const { pageTitle } = useAppRouteHandle();
  const mock = isUsingMock();

  return (
    <header className={styles.header}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <div className={styles.logoMark} aria-hidden>
            <CupertinoIcon svg={houseFillSvg} className={styles.logoIcon} />
          </div>
          <div className={styles.brandText}>
            <p className={styles.brand}>
              <span className={styles.brandPrimary}>{BRAND.wordPrimary}</span>
              <span className={styles.brandAccent}>{BRAND.wordAccent}</span>
            </p>
            <p className={styles.subtitle}>{pageTitle}</p>
          </div>
        </div>

        <div className={styles.trailing}>
          <AppHeaderAlertButton />
          {mock ? (
            <span className={styles.mockBadge}>Mock</span>
          ) : (
            <span className={styles.liveBadge}>
              <span className={styles.liveDot} aria-hidden />
              Live
            </span>
          )}
        </div>
      </div>
      <div className={styles.accentLine} aria-hidden />
    </header>
  );
}
