import type { ScheduleHolidayMode } from "@/api/types";
import styles from "./HolidayOptions.module.css";

interface HolidayOptionsProps {
  holidayMode: ScheduleHolidayMode;
  includeSubstitute: boolean;
  onHolidayModeChange: (mode: ScheduleHolidayMode) => void;
  onIncludeSubstituteChange: (value: boolean) => void;
}

const MODES: { value: ScheduleHolidayMode; label: string }[] = [
  { value: "skip", label: "건너뛰기" },
  { value: "run", label: "실행" },
];

export function HolidayOptions({
  holidayMode,
  includeSubstitute,
  onHolidayModeChange,
  onIncludeSubstituteChange,
}: HolidayOptionsProps) {
  return (
    <div className={styles.root}>
      <span className={styles.label}>공휴일</span>
      <div className={styles.row}>
        <div className={styles.modes} role="group" aria-label="공휴일 동작">
          {MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={`${styles.mode} ${
                holidayMode === mode.value ? styles.modeActive : ""
              }`.trim()}
              aria-pressed={holidayMode === mode.value}
              onClick={() => onHolidayModeChange(mode.value)}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <label className={styles.substitute}>
          <input
            type="checkbox"
            checked={includeSubstitute}
            onChange={(e) => onIncludeSubstituteChange(e.target.checked)}
          />
          대체공휴일
        </label>
      </div>
    </div>
  );
}
