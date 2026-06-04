import { useSyncExternalStore } from "react";
import arrowUpRightSvg from "cupertino-icons-svg/svg/arrow_up_right_square.svg?raw";
import appBadgeSvg from "cupertino-icons-svg/svg/app_badge_fill.svg?raw";
import type { CSSProperties } from "react";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { HOME_DOMAIN_THEME } from "@/features/home/utils/homeDomainTheme";
import { getPwaDisplayMode } from "@/utils/pwaDisplayMode";
import styles from "./SettingsAccessPanel.module.css";

const theme = HOME_DOMAIN_THEME.settings;
const IOT_URL = "https://iot.iwhya.kr";

const STEPS = [
  {
    num: "1",
    title: "Tailscale 켜기",
    body: "집 네트워크에 연결된 뒤 다음 단계로 진행하세요.",
  },
  {
    num: "2",
    title: "대시보드 열기",
    body: "아래 버튼으로 iot.iwhya.kr에 접속합니다.",
  },
  {
    num: "3",
    title: "홈 화면에 추가",
    body: "자주 쓰면 PWA로 설치해 앱처럼 실행하세요.",
  },
] as const;

function subscribePwaMode(onStoreChange: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getPwaModeSnapshot() {
  return getPwaDisplayMode();
}

export function SettingsAccessPanel() {
  const pwaMode = useSyncExternalStore(
    subscribePwaMode,
    getPwaModeSnapshot,
    () => "browser" as const,
  );
  const installed = pwaMode === "standalone";

  return (
    <section
      className={styles.card}
      style={{ "--settings-accent": theme.accent } as CSSProperties}
      aria-label="접속 및 설치"
    >
      <h2 className={styles.title}>접속 · 설치</h2>

      <div
        className={`${styles.statusPill} ${installed ? styles.statusPillOk : styles.statusPillMuted}`.trim()}
      >
        <span className={styles.statusDot} aria-hidden />
        {installed ? "앱(홈 화면)으로 실행 중" : "브라우저 탭에서 열림"}
      </div>

      <a
        href={IOT_URL}
        className={styles.cta}
        target="_blank"
        rel="noopener noreferrer"
      >
        <CupertinoIcon svg={arrowUpRightSvg} className={styles.ctaIcon} />
        <span>iot.iwhya.kr 열기</span>
      </a>

      <ol className={styles.steps}>
        {STEPS.map((step) => (
          <li key={step.num} className={styles.step}>
            <span className={styles.stepNum}>{step.num}</span>
            <div className={styles.stepBody}>
              <p className={styles.stepTitle}>{step.title}</p>
              <p className={styles.stepText}>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className={styles.platformGrid}>
        <div className={styles.platformCard}>
          <div className={styles.platformHead}>
            <CupertinoIcon svg={appBadgeSvg} className={styles.platformIcon} />
            <span className={styles.platformName}>iOS</span>
          </div>
          <p className={styles.platformText}>
            Safari에서 열기 → 공유 → <strong>홈 화면에 추가</strong>
          </p>
        </div>
        <div className={styles.platformCard}>
          <div className={styles.platformHead}>
            <span className={styles.platformEmoji} aria-hidden>
              ◆
            </span>
            <span className={styles.platformName}>Android · PC</span>
          </div>
          <p className={styles.platformText}>
            주소창 옆 <strong>설치</strong> 또는 메뉴의 앱 설치 항목을
            이용하세요.
          </p>
        </div>
      </div>
    </section>
  );
}
