import type { CSSProperties } from "react";
import bellSvg from "cupertino-icons-svg/svg/bell_fill.svg?raw";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { useAcPushToggle } from "@/hooks/useAcPush";
import { HOME_DOMAIN_THEME } from "@/features/home/utils/homeDomainTheme";
import { getPwaDisplayMode } from "@/utils/pwaDisplayMode";
import { isIosDevice } from "@/push/deviceLabel";
import styles from "./SettingsAcPushPanel.module.css";

const theme = HOME_DOMAIN_THEME.ac;

export function SettingsAcPushPanel() {
  const { status, enabled, blockReason, blockMessage, busy, setEnabled } =
    useAcPushToggle();

  const iosBrowser =
    isIosDevice() &&
    getPwaDisplayMode() !== "standalone" &&
    blockReason === "ios-not-installed";

  const toggleDisabled =
    busy || status === "loading" || (status === "blocked" && !enabled);

  return (
    <section
      className={styles.card}
      style={{ "--settings-accent": theme.accent } as CSSProperties}
      aria-label="에어컨 이상 알림"
    >
      <div className={styles.head}>
        <CupertinoIcon svg={bellSvg} className={styles.headIcon} />
        <h2 className={styles.title}>에어컨 이상 알림</h2>
      </div>

      <p className={styles.desc}>
        에어컨 이상이 감지되면 푸시로 알려 드립니다. 12시간에 한 번까지 발송됩니다.
      </p>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="ac-push-toggle">
          알림 받기
        </label>
        <button
          id="ac-push-toggle"
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-busy={busy}
          disabled={toggleDisabled}
          className={`${styles.switch} ${enabled ? styles.switchOn : ""}`.trim()}
          onClick={() => void setEnabled(!enabled)}
        >
          <span className={styles.switchThumb} aria-hidden />
        </button>
      </div>

      {status === "loading" ? (
        <p className={styles.hint}>알림 설정을 확인하는 중…</p>
      ) : null}

      {enabled && status === "on" ? (
        <p className={styles.statusOk}>등록됨 — 이 기기로 푸시를 받습니다.</p>
      ) : null}

      {blockMessage ? (
        <p
          className={
            blockReason === "permission-denied"
              ? styles.statusWarn
              : styles.statusMuted
          }
        >
          {blockMessage}
        </p>
      ) : null}

      {iosBrowser ? (
        <div className={styles.iosGuide}>
          <p className={styles.iosTitle}>iOS Web Push 안내</p>
          <ol className={styles.iosSteps}>
            <li>Safari에서 이 사이트를 엽니다.</li>
            <li>
              공유 버튼 → <strong>홈 화면에 추가</strong>
            </li>
            <li>홈 화면 아이콘으로 실행한 뒤 알림을 켜 주세요.</li>
          </ol>
          <p className={styles.iosNote}>iOS 16.4 이상 · 홈 화면 PWA 필요</p>
        </div>
      ) : null}
    </section>
  );
}
