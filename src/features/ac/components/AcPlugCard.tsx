import type { CSSProperties } from "react";
import powerSvg from "cupertino-icons-svg/svg/power.svg?raw";
import type { AcStateResponse, OnOffAction, PlugStatus } from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { MiniPowerBar } from "@/components/viz/MiniPowerBar";
import { useMutationErrorToast } from "@/hooks/useMutationErrorToast";
import type { useAcRecover } from "@/hooks/useStatus";
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
  acState: AcStateResponse | undefined;
  mutation: UseMutationResult<unknown, Error, OnOffAction, unknown>;
  recoverMutation: ReturnType<typeof useAcRecover>;
}

function isPlugCutSafe(acState: AcStateResponse | undefined): boolean {
  if (acState?.plug_cut_safe === true) return true;
  if (acState?.soft_off === true) return true;
  // 구 API·미수신: 차단하지 않음(호환). 신 API는 false면 차단.
  if (acState?.plug_cut_safe === false) return false;
  return true;
}

function getPlugHint(
  plug: PlugStatus,
  plugOn: boolean,
  highLoad: boolean,
  cutSafe: boolean,
): string {
  if (plug.power_stale === true) {
    return "전력 미갱신 — 콘센트 측정만으로 에어컨 가동을 단정하지 않음";
  }
  if (plugOn && !cutSafe) {
    return "가동 중 — IR로 끈 뒤 soft-off 확인되면 콘센트 OFF 가능";
  }
  if (!plugOn) {
    return "에어컨 전원 차단 (콘센트 OFF ≠ 가동 판정)";
  }
  if (highLoad) {
    return "콘센트 고부하(≥50W) — 에어컨 가동과 별개 표시";
  }
  return "대기·저전력일 수 있음 — 콘센트 ≠ 에어컨 가동";
}

export function AcPlugCard({
  plug,
  acState,
  mutation,
  recoverMutation,
}: AcPlugCardProps) {
  const plugOn = plug.switch === "on";
  const highLoad = (plug.power_w ?? 0) >= PLUG_HIGH_W;
  const stale = plug.power_stale === true;
  const cutSafe = isPlugCutSafe(acState);
  const offBlocked = plugOn && !cutSafe;
  const showRecover = plugOn && !cutSafe;

  useMutationErrorToast(
    mutation,
    TOAST_DEVICE.plug,
    TOAST_GUIDE.retry,
    "control",
  );
  useMutationErrorToast(
    recoverMutation,
    TOAST_DEVICE.ac,
    TOAST_GUIDE.retry,
    "control",
  );

  const post = (action: OnOffAction) => {
    if (mutation.isPending || plug.switch === action) return;
    if (action === "off" && !cutSafe) return;
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
            {getPlugHint(plug, plugOn, highLoad, cutSafe)}
          </p>
        </div>
        <span
          className={`${styles.statePill} ${
            stale
              ? styles.statePillWarn
              : offBlocked
                ? styles.statePillWarn
                : plugOn
                  ? styles.statePillOn
                  : styles.statePillOff
          }`.trim()}
        >
          {stale ? "STALE" : offBlocked ? "GATE" : plugOn ? "ON" : "OFF"}
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
        {acState?.soft_off === true ? (
          <span className={styles.metaPill}>soft-off</span>
        ) : null}
        {acState?.plug_cut_safe === true ? (
          <span className={styles.metaPill}>cut-safe</span>
        ) : null}
      </div>

      <div className={styles.controlBlock}>
        <button
          type="button"
          className={`${styles.toggleBtn} ${plugOn ? styles.toggleBtnOn : styles.toggleBtnOff}`.trim()}
          disabled={mutation.isPending || offBlocked}
          aria-pressed={plugOn}
          title={
            offBlocked
              ? "IR soft-off 후 콘센트 OFF 가능"
              : undefined
          }
          onClick={() => post(plugOn ? "off" : "on")}
        >
          {mutation.isPending
            ? "처리 중…"
            : offBlocked
              ? "끄기 (soft-off 대기)"
              : plugOn
                ? "끄기"
                : "켜기"}
        </button>
        {showRecover ? (
          <button
            type="button"
            className={styles.recoverBtn}
            disabled={recoverMutation.isPending || mutation.isPending}
            onClick={() => recoverMutation.mutate("auto")}
          >
            {recoverMutation.isPending ? "복구 중…" : "복구 (IR 재송신)"}
          </button>
        ) : null}
        <p className={styles.hint}>
          {offBlocked
            ? "가동 중 hard-cut 방지: 먼저 에어컨 IR OFF(또는 복구)로 soft-off 한 뒤 콘센트를 끄세요."
            : "콘센트 전원 ≠ 에어컨 가동 표시. HA 자동제어와 연동 · 끄면 집 자동 ON이 멈출 수 있음"}
        </p>
      </div>
    </section>
  );
}
