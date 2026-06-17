import { useRef } from "react";
import { HUE_SPECTRUM_PRESETS, hsToHex } from "@/utils/moodColors";
import styles from "./MoodHuePicker.module.css";

interface MoodHuePickerHsProps {
  mode: "hs";
  hue: number;
  saturation: number;
  hex: string;
  disabled?: boolean;
  pending?: boolean;
  onHueChange: (hue: number) => void;
  onSaturationChange: (saturation: number) => void;
  onApplyHs: (hue: number, saturation: number) => void;
  onHexChange: (hex: string) => void;
  onApplyHex: (hex: string) => void;
}

interface MoodHuePickerRgbProps {
  mode: "rgb";
  hex: string;
  disabled?: boolean;
  pending?: boolean;
  onHexChange: (hex: string) => void;
  onApplyHex: (hex: string) => void;
}

export type MoodHuePickerProps = MoodHuePickerHsProps | MoodHuePickerRgbProps;

export function MoodHuePicker(props: MoodHuePickerProps) {
  if (props.mode === "hs") {
    return <MoodHuePickerHs {...props} />;
  }
  return <MoodHuePickerRgb {...props} />;
}

function MoodHuePickerHs({
  hue,
  saturation,
  hex,
  disabled,
  pending,
  onHueChange,
  onSaturationChange,
  onApplyHs,
  onHexChange,
  onApplyHex,
}: MoodHuePickerHsProps) {
  const hsDirtyRef = useRef(false);
  const hueRef = useRef(hue);
  const saturationRef = useRef(saturation);
  hueRef.current = hue;
  saturationRef.current = saturation;
  const previewHex = hsToHex(hue, saturation);

  const commitHs = () => {
    if (!hsDirtyRef.current) return;
    hsDirtyRef.current = false;
    onApplyHs(hueRef.current, saturationRef.current);
  };

  const applyHexPreset = (nextHex: string) => {
    onHexChange(nextHex);
    onApplyHex(nextHex);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.previewRow}>
        <span
          className={styles.wheelPreview}
          style={{ backgroundColor: previewHex }}
          aria-hidden
        />
        <p className={styles.hsSummary}>
          H {hue}° · S {saturation}%
        </p>
      </div>

      <div className={styles.hsControl}>
        <div className={styles.hsHead}>
          <span className={styles.hsLabel}>색조 (H)</span>
          <span className={styles.hsValue}>{hue}°</span>
        </div>
        <input
          type="range"
          className={styles.slider}
          min={0}
          max={360}
          value={hue}
          disabled={disabled}
          aria-label={`색조 ${hue}도`}
          onChange={(e) => {
            const value = Number(e.target.value);
            hsDirtyRef.current = true;
            hueRef.current = value;
            onHueChange(value);
          }}
          onPointerUp={commitHs}
          onTouchEnd={commitHs}
          onKeyUp={commitHs}
        />
      </div>

      <div className={styles.hsControl}>
        <div className={styles.hsHead}>
          <span className={styles.hsLabel}>채도 (S)</span>
          <span className={styles.hsValue}>{saturation}%</span>
        </div>
        <input
          type="range"
          className={styles.slider}
          min={0}
          max={100}
          value={saturation}
          disabled={disabled}
          aria-label={`채도 ${saturation}%`}
          onChange={(e) => {
            const value = Number(e.target.value);
            hsDirtyRef.current = true;
            saturationRef.current = value;
            onSaturationChange(value);
          }}
          onPointerUp={commitHs}
          onTouchEnd={commitHs}
          onKeyUp={commitHs}
        />
      </div>

      <div className={styles.hexRow}>
        <label className={styles.hexLabel}>
          <span className={styles.hexLabelText}>RGB / HEX</span>
          <input
            type="text"
            className={styles.hexInput}
            value={hex}
            disabled={disabled}
            spellCheck={false}
            autoCapitalize="off"
            aria-label="HEX 색상 코드"
            onChange={(e) => onHexChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onApplyHex(hex);
              }
            }}
          />
        </label>
      </div>

      <div className={styles.presetGrid} role="group" aria-label="색상 프리셋">
        {HUE_SPECTRUM_PRESETS.map((preset) => (
          <button
            key={preset.hex}
            type="button"
            className={styles.presetBtn}
            disabled={disabled}
            aria-label={preset.label}
            title={preset.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyHexPreset(preset.hex)}
          >
            <span
              className={styles.presetSwatch}
              style={{ background: preset.hex }}
              aria-hidden
            />
          </button>
        ))}
      </div>

      {pending ? <p className={styles.pending}>색상 적용 중…</p> : null}
    </div>
  );
}

function MoodHuePickerRgb({
  hex,
  disabled,
  pending,
  onHexChange,
  onApplyHex,
}: MoodHuePickerRgbProps) {
  const applyPreset = (nextHex: string) => {
    onHexChange(nextHex);
    onApplyHex(nextHex);
  };

  return (
    <div className={styles.wrap}>
      <label className={styles.wheel}>
        <span
          className={styles.wheelPreview}
          style={{ backgroundColor: hex }}
          aria-hidden
        />
        <input
          type="color"
          className={styles.wheelInput}
          value={hex}
          disabled={disabled}
          aria-label="색상 선택"
          onChange={(e) => {
            const nextHex = e.target.value;
            onHexChange(nextHex);
            onApplyHex(nextHex);
          }}
        />
        <span className={styles.wheelHex}>{hex.toUpperCase()}</span>
      </label>

      <div className={styles.presetGrid} role="group" aria-label="색상 프리셋">
        {HUE_SPECTRUM_PRESETS.map((preset) => (
          <button
            key={preset.hex}
            type="button"
            className={styles.presetBtn}
            disabled={disabled}
            aria-label={preset.label}
            title={preset.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyPreset(preset.hex)}
          >
            <span
              className={styles.presetSwatch}
              style={{ background: preset.hex }}
              aria-hidden
            />
          </button>
        ))}
      </div>

      {pending ? <p className={styles.pending}>색상 적용 중…</p> : null}
    </div>
  );
}
