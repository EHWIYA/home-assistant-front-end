import powerSvg from "cupertino-icons-svg/svg/power.svg?raw";
import type { CSSProperties } from "react";
import type { OnOffAction, PcStatus } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { HOME_DOMAIN_THEME } from "@/features/home/utils/homeDomainTheme";
import { useMutationErrorToast } from "@/hooks/useMutationErrorToast";
import { TOAST_DEVICE, TOAST_GUIDE } from "@/utils/toastMessages";
import {
  getPcStatusLabel,
  isPcControllable,
  requestPcToggle,
} from "@/utils/pcStatus";
import styles from "./PcControlPanel.module.css";

const theme = HOME_DOMAIN_THEME.pc;

interface PcControlPanelProps {
  pc: PcStatus;
  mutation: UseMutationResult<unknown, Error, OnOffAction, unknown>;
}

export function PcControlPanel({ pc, mutation }: PcControlPanelProps) {
  const pcOn = pc.switch === "on";
  const controllable = isPcControllable(pc);

  useMutationErrorToast(mutation, TOAST_DEVICE.pc, TOAST_GUIDE.retry, "control");

  const toggle = () => {
    if (!controllable || mutation.isPending) return;
    requestPcToggle(pcOn ? "off" : "on", mutation.mutate);
  };

  return (
    <section
      className={styles.card}
      style={
        {
          "--pc-accent": theme.accent,
          "--pc-accent-glow": theme.accentGlow,
        } as CSSProperties
      }
      aria-label="PC 콘센트 제어"
    >
      <header className={styles.header}>
        <span className={styles.iconPill}>
          <CupertinoIcon svg={powerSvg} className="" />
        </span>
        <div>
          <h2 className={styles.title}>Tapo 콘센트</h2>
          <p className={styles.subtitle}>HWIYA-PC 스마트 플러그</p>
        </div>
      </header>

      <div className={styles.statusRow}>
        <span
          className={`${styles.dot} ${pcOn ? styles.dotOn : styles.dotOff}`.trim()}
          aria-hidden
        />
        <div>
          <p className={styles.statusLabel}>{getPcStatusLabel(pc)}</p>
          <p className={styles.statusHint}>
            {pc.switch === "unavailable"
              ? "Tapo·HA 연동 확인 필요"
              : !pc.online
                ? "오프라인 — 제어 불가"
                : pcOn
                  ? "콘센트 전원 공급 중"
                  : "콘센트 차단됨"}
          </p>
        </div>
        <span
          className={`${styles.statePill} ${pcOn ? styles.statePillOn : styles.statePillOff}`.trim()}
        >
          {pc.switch === "on"
            ? "ON"
            : pc.switch === "off"
              ? "OFF"
              : "—"}
        </span>
      </div>

      {pc.switch === "unavailable" ? (
        <p className={styles.blockedHint}>
          Tapo 연동이 불가합니다. HA·API 상태를 확인해 주세요.
        </p>
      ) : null}
      {!pc.online ? (
        <p className={styles.blockedHint}>
          기기가 오프라인입니다. 제어할 수 없습니다.
        </p>
      ) : null}

      <div className={styles.controlBlock}>
        <button
          type="button"
          className={`${styles.toggleBtn} ${pcOn ? styles.toggleBtnOn : styles.toggleBtnOff}`.trim()}
          disabled={!controllable || mutation.isPending}
          aria-pressed={pcOn}
          onClick={toggle}
        >
          {mutation.isPending
            ? "처리 중…"
            : pcOn
              ? "끄기"
              : "켜기"}
        </button>
        <p className={styles.hint}>
          끄기는 PC 전원 차단입니다. 안전 종료 후에만 사용하세요.
        </p>
      </div>
    </section>
  );
}
