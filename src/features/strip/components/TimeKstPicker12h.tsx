import {
  time12hToKst,
  timeKstTo12h,
  type Time12hPeriod,
} from "@/utils/schedule";
import styles from "./TimeKstPicker12h.module.css";

interface TimeKstPicker12hProps {
  value: string;
  onChange: (timeKst: string) => void;
  id?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export function TimeKstPicker12h({ value, onChange, id }: TimeKstPicker12hProps) {
  const parts = timeKstTo12h(value) ?? {
    hour12: 8,
    minute: 0,
    period: "AM" as Time12hPeriod,
  };

  function emit(next: Partial<typeof parts>) {
    const merged = { ...parts, ...next };
    const kst = time12hToKst(merged);
    if (kst) onChange(kst);
  }

  return (
    <div className={styles.root} id={id}>
      <select
        className={styles.select}
        value={parts.hour12}
        aria-label="시"
        onChange={(e) => emit({ hour12: Number(e.target.value) })}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}시
          </option>
        ))}
      </select>
      <select
        className={styles.select}
        value={parts.minute}
        aria-label="분"
        onChange={(e) => emit({ minute: Number(e.target.value) })}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}분
          </option>
        ))}
      </select>
      <select
        className={styles.select}
        value={parts.period}
        aria-label="오전 또는 오후"
        onChange={(e) => emit({ period: e.target.value as Time12hPeriod })}
      >
        <option value="AM">오전</option>
        <option value="PM">오후</option>
      </select>
    </div>
  );
}
