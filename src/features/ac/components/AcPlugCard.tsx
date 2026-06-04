import type { CSSProperties } from "react";
import powerSvg from "cupertino-icons-svg/svg/power.svg?raw";
import type { OnOffAction, PlugStatus } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { MiniPowerBar } from "@/components/viz/MiniPowerBar";
import { useMutationErrorToast } from "@/hooks/useMutationErrorToast";
import { normalizePowerW } from "@/features/home/utils/homeDomainTheme";
import { formatEstimatedCostWon } from "@/utils/electricity";
import { formatPowerW } from "@/utils/power";
import { TOAST_DEVICE, TOAST_GUIDE } from "@/utils/toastMessages";
import styles from "./AcPlugCard.module.css";

const PLUG_ACCENT = "#e8a735";
const PLUG_ACCENT_GLOW = "rgba(232, 167, 53, 0.35)";
const PLUG_HIGH_W = 50;

interface AcPlugCardProps {
  plug: PlugStatus;
  mutation: UseMutationResult<unknown, Error, OnOffAction, unknown>;
}

export function AcPlugCard({ plug, mutation }: AcPlugCardProps) {
  const plugOn = plug.switch === "on";
  const highLoad = (plug.power_w ?? 0) >= PLUG_HIGH_W;

  useMutationErrorToast(
    mutation,
    TOAST_DEVICE.plug,
    TOAST_GUIDE.retry,
    "control",
  );

  const post = (action: OnOffAction) => {
    if (mutation.isPending || plug.switch === action) return;
    mutation.mutate(action);
  };

  return (
    <section
      className={styles.card}
      style={
        {
          "--plug-accent": PLUG_ACCENT,
          "--plug-accent-glow": PLUG_ACCENT_GLOW,
        } as CSSProperties
      }
      aria-label="스마트 플러그"
    >
      <header className={styles.header}>
        <span className={styles.iconPill}>
          <CupertinoIcon svg={powerSvg} className="" />
        </span>
        <div>
          <h2 className={styles.title}>스마트 플러그</h2>
          <p className={styles.subtitle}>에어컨 콘센트 전원</p>
        </div>
      </header>

      <div className={styles.statusRow}>
        <span
          className={`${styles.dot} ${plugOn ? styles.dotOn : styles.dotOff}`.trim()}
          aria-hidden
        />
        <div>
          <p className={styles.statusLabel}>{plugOn ? "전원 켜짐" : "전원 꺼짐"}</p>
          <p className={styles.statusHint}>
            {plugOn
              ? highLoad
                ? "가동 중으로 보임 (50W 이상)"
                : "대기·저전력일 수 있음"
              : "에어컨 전원 차단"}
          </p>
        </div>
        <span
          className={`${styles.statePill} ${plugOn ? styles.statePillOn : styles.statePillOff}`.trim()}
        >
          {plugOn ? "ON" : "OFF"}
        </span>
      </div>

      <div className={styles.powerSection}>
        <p className={styles.powerValue}>{formatPowerW(plug.power_w)}</p>
        <MiniPowerBar
          value={normalizePowerW(plug.power_w)}
          color={PLUG_ACCENT}
          label="실시간 전력"
        />
      </div>

      <div className={styles.metaRow}>
        <span className={styles.metaPill}>누적 {plug.energy_kwh.toFixed(2)} kWh</span>
        {plug.estimated_cost_won != null ? (
          <span className={styles.metaPill}>
            {formatEstimatedCostWon(plug.estimated_cost_won)}
          </span>
        ) : null}
      </div>

      <div className={styles.controlBlock}>
        <button
          type="button"
          className={`${styles.toggleBtn} ${plugOn ? styles.toggleBtnOn : styles.toggleBtnOff}`.trim()}
          disabled={mutation.isPending}
          aria-pressed={plugOn}
          onClick={() => post(plugOn ? "off" : "on")}
        >
          {mutation.isPending
            ? "처리 중…"
            : plugOn
              ? "끄기"
              : "켜기"}
        </button>
        <p className={styles.hint}>HA 자동제어와 연동 · 끄면 집 자동 ON이 멈출 수 있음</p>
      </div>
    </section>
  );
}
