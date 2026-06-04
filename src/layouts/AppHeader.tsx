import { useLocation } from "react-router-dom";
import houseFillSvg from "cupertino-icons-svg/svg/house_fill.svg?raw";
import { isUsingMock } from "@/api/client";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { BRAND } from "@/config/brand";
import styles from "./AppHeader.module.css";

function getPageSubtitle(pathname: string): string {
  if (pathname === "/" || pathname === "") {
    return "홈";
  }
  if (pathname.startsWith("/ac")) {
    return "에어컨";
  }
  if (pathname.startsWith("/pc")) {
    return "PC";
  }
  if (pathname.startsWith("/strip")) {
    return "멀티탭";
  }
  if (pathname.startsWith("/settings")) {
    return "설정";
  }
  return BRAND.tagline;
}

export function AppHeader() {
  const { pathname } = useLocation();
  const subtitle = getPageSubtitle(pathname);
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
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
        </div>

        <div className={styles.trailing}>
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
