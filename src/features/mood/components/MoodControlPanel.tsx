import { useEffect, useRef, useState, type CSSProperties } from "react";
import powerSvg from "cupertino-icons-svg/svg/power.svg?raw";
import type {
  MoodCapabilitiesResponse,
  MoodColorHsRequest,
  MoodColorRgbRequest,
  MoodMetaResponse,
  MoodStateResponse,
} from "@/api/types";
import type { UseMutationResult } from "@tanstack/react-query";
import { CupertinoIcon } from "@/components/icons/CupertinoIcon";
import { HOME_DOMAIN_THEME } from "@/features/home/utils/homeDomainTheme";
import { useMoodCommandSuccessToast } from "@/hooks/useMoodCommandSuccessToast";
import { useMutationErrorToast } from "@/hooks/useMutationErrorToast";
import { MoodHuePicker } from "./MoodHuePicker";
import {
  getMoodStateHex,
  getMoodStateHs,
  hasMoodAction,
  hexToHs,
  hsToHex,
  parseHexColor,
  prefersMoodColorRgb,
  supportsMoodColorTemperature,
  supportsMoodHs,
  supportsMoodRgb,
} from "@/utils/moodColors";
import { TOAST_DEVICE, TOAST_GUIDE } from "@/utils/toastMessages";
import styles from "./MoodControlPanel.module.css";

const theme = HOME_DOMAIN_THEME.mood;

interface MoodControlPanelProps {
  meta: MoodMetaResponse;
  capabilities: MoodCapabilitiesResponse;
  state?: MoodStateResponse;
  powerMutation: UseMutationResult<unknown, Error, boolean, unknown>;
  brightnessMutation: UseMutationResult<
    unknown,
    Error,
    { percent: number },
    unknown
  >;
  colorHsMutation: UseMutationResult<
    unknown,
    Error,
    MoodColorHsRequest,
    unknown
  >;
  colorRgbMutation: UseMutationResult<
    unknown,
    Error,
    MoodColorRgbRequest,
    unknown
  >;
  colorTemperatureMutation: UseMutationResult<
    unknown,
    Error,
    "warm" | "cool",
    unknown
  >;
}

export function MoodControlPanel({
  meta,
  capabilities,
  state,
  powerMutation,
  brightnessMutation,
  colorHsMutation,
  colorRgbMutation,
  colorTemperatureMutation,
}: MoodControlPanelProps) {
  const [minBrightness, maxBrightness] = capabilities.brightness_range;
  const defaultBrightness = Math.round((minBrightness + maxBrightness) / 2);
  const [brightness, setBrightness] = useState(defaultBrightness);
  const [hue, setHue] = useState(280);
  const [saturation, setSaturation] = useState(65);
  const [hexInput, setHexInput] = useState("#c77dff");
  const brightnessDirtyRef = useRef(false);
  const lastSentHexRef = useRef<string | null>(null);
  const stateReadable = meta.state_readable;
  const hasHs = supportsMoodHs(capabilities);
  const hasRgb = supportsMoodRgb(capabilities);
  const useRgbPath = prefersMoodColorRgb(capabilities);
  const showKelvin = supportsMoodColorTemperature(capabilities);
  const colorPending = colorHsMutation.isPending || colorRgbMutation.isPending;

  useEffect(() => {
    if (!stateReadable || !state) return;
    if (state.brightness != null && !brightnessDirtyRef.current) {
      setBrightness(Math.round(state.brightness));
    }
    const stateHs = getMoodStateHs(state);
    if (stateHs) {
      setHue(stateHs.hue);
      setSaturation(stateHs.saturation);
    }
    const stateHex = getMoodStateHex(state);
    if (stateHex) {
      const normalized = stateHex.toLowerCase();
      setHexInput(normalized);
      lastSentHexRef.current = normalized;
    }
  }, [stateReadable, state]);

  useMoodCommandSuccessToast(powerMutation);

  useMutationErrorToast(
    powerMutation,
    TOAST_DEVICE.mood,
    TOAST_GUIDE.retry,
    "control",
  );
  useMutationErrorToast(
    brightnessMutation,
    TOAST_DEVICE.mood,
    TOAST_GUIDE.retry,
    "control",
  );
  useMutationErrorToast(
    colorHsMutation,
    TOAST_DEVICE.mood,
    TOAST_GUIDE.retry,
    "control",
  );
  useMutationErrorToast(
    colorRgbMutation,
    TOAST_DEVICE.mood,
    TOAST_GUIDE.retry,
    "control",
  );
  useMutationErrorToast(
    colorTemperatureMutation,
    TOAST_DEVICE.mood,
    TOAST_GUIDE.retry,
    "control",
  );

  const commitBrightness = () => {
    if (!brightnessDirtyRef.current) {
      return;
    }
    brightnessDirtyRef.current = false;
    brightnessMutation.mutate({ percent: brightness });
  };

  const postPower = (on: boolean) => {
    if (powerMutation.isPending) return;
    powerMutation.mutate(on);
  };

  const applyColorHex = (rawHex: string) => {
    if (colorPending) return;

    const rgb = parseHexColor(rawHex);
    if (!rgb) return;

    const hex = `#${rawHex.trim().replace(/^#/, "").toLowerCase()}`;
    if (lastSentHexRef.current === hex) return;

    const hs = hexToHs(hex);
    if (hs) {
      setHue(hs.hue);
      setSaturation(hs.saturation);
    }
    setHexInput(hex);
    lastSentHexRef.current = hex;

    if (useRgbPath && hasRgb) {
      colorRgbMutation.mutate({ hex });
      return;
    }

    if (hasHs && hs && hasMoodAction(capabilities, "color-hs")) {
      colorHsMutation.mutate({ hue: hs.hue, saturation: hs.saturation });
    }
  };

  const applyHs = (nextHue: number, nextSaturation: number) => {
    if (!hasHs || colorPending) return;
    setHue(nextHue);
    setSaturation(nextSaturation);
    applyColorHex(hsToHex(nextHue, nextSaturation));
  };

  const applyColorTemperature = (mode: "warm" | "cool") => {
    if (colorTemperatureMutation.isPending) return;
    colorTemperatureMutation.mutate(mode);
  };

  return (
    <section
      className={styles.card}
      style={{ "--mood-accent": theme.accent } as CSSProperties}
      aria-label="무드등 제어"
    >
      <header className={styles.header}>
        <span className={styles.iconPill}>
          <CupertinoIcon svg={powerSvg} className="" />
        </span>
        <h2 className={styles.title}>제어</h2>
      </header>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>전원</p>
        <div className={styles.powerRow} role="group" aria-label="전원">
          <button
            type="button"
            className={styles.powerBtn}
            disabled={powerMutation.isPending}
            onClick={() => postPower(true)}
          >
            {powerMutation.isPending && powerMutation.variables === true
              ? "…"
              : "켜기"}
          </button>
          <button
            type="button"
            className={`${styles.powerBtn} ${styles.powerBtnOff}`}
            disabled={powerMutation.isPending}
            onClick={() => postPower(false)}
          >
            {powerMutation.isPending && powerMutation.variables === false
              ? "…"
              : "끄기"}
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <p className={styles.sectionTitle}>밝기</p>
          <span className={styles.brightnessValue}>{brightness}%</span>
        </div>
        <input
          type="range"
          className={styles.slider}
          min={minBrightness}
          max={maxBrightness}
          value={brightness}
          disabled={brightnessMutation.isPending}
          aria-label={`밝기 ${brightness}%`}
          onChange={(e) => {
            brightnessDirtyRef.current = true;
            setBrightness(Number(e.target.value));
          }}
          onPointerUp={commitBrightness}
          onTouchEnd={commitBrightness}
          onKeyUp={commitBrightness}
        />
      </div>

      {hasHs ? (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>색상</p>
          <MoodHuePicker
            mode="hs"
            hue={hue}
            saturation={saturation}
            hex={hexInput}
            disabled={colorPending}
            pending={colorPending}
            onHueChange={setHue}
            onSaturationChange={setSaturation}
            onApplyHs={applyHs}
            onHexChange={setHexInput}
            onApplyHex={applyColorHex}
          />
        </div>
      ) : hasRgb ? (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>색상</p>
          <MoodHuePicker
            mode="rgb"
            hex={hexInput}
            disabled={colorRgbMutation.isPending}
            pending={colorRgbMutation.isPending}
            onHexChange={setHexInput}
            onApplyHex={applyColorHex}
          />
        </div>
      ) : null}

      {showKelvin && hasMoodAction(capabilities, "color-temperature") ? (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>색온도</p>
          <div className={styles.tempRow} role="group" aria-label="색온도">
            <button
              type="button"
              className={styles.tempBtn}
              disabled={colorTemperatureMutation.isPending}
              onClick={() => applyColorTemperature("warm")}
            >
              <span>따뜻함</span>
            </button>
            <button
              type="button"
              className={styles.tempBtn}
              disabled={colorTemperatureMutation.isPending}
              onClick={() => applyColorTemperature("cool")}
            >
              <span>차가움</span>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
