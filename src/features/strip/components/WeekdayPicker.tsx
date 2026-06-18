import { WEEKDAY_LABELS } from "@/utils/schedule";
import styles from "./WeekdayPicker.module.css";

const PRESETS = [
  { label: "매일", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "평일", days: [0, 1, 2, 3, 4] },
  { label: "주말", days: [5, 6] },
] as const;

interface WeekdayPickerProps {
  value: number[];
  onChange: (days: number[]) => void;
}

export function WeekdayPicker({ value, onChange }: WeekdayPickerProps) {
  const selected = new Set(value);

  function toggle(day: number) {
    const next = selected.has(day)
      ? value.filter((d) => d !== day)
      : [...value, day].sort((a, b) => a - b);
    onChange(next);
  }

  function applyPreset(days: readonly number[]) {
    onChange([...days]);
  }

  const presetActive = (days: readonly number[]) =>
    days.length === value.length && days.every((d) => selected.has(d));

  return (
    <div className={styles.root}>
      <div className={styles.days} role="group" aria-label="반복 요일">
        {WEEKDAY_LABELS.map((label, day) => {
          const active = selected.has(day);
          const weekend = day >= 5;
          return (
            <button
              key={label}
              type="button"
              className={`${styles.day} ${active ? styles.dayActive : ""} ${
                weekend ? styles.dayWeekend : ""
              }`.trim()}
              aria-pressed={active}
              onClick={() => toggle(day)}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className={styles.presets} role="group" aria-label="요일 빠른 선택">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={`${styles.preset} ${
              presetActive(preset.days) ? styles.presetActive : ""
            }`.trim()}
            aria-pressed={presetActive(preset.days)}
            onClick={() => applyPreset(preset.days)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
