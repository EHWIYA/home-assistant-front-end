import type { OnOffAction } from "@/api/types";
import styles from "./OnOffSegment.module.css";

interface OnOffSegmentProps {
  value: boolean;
  onChange: (on: boolean) => void;
  onLabel?: string;
  offLabel?: string;
}

export function OnOffSegment({
  value,
  onChange,
  onLabel = "켜기",
  offLabel = "끄기",
}: OnOffSegmentProps) {
  const options: { key: OnOffAction; label: string; active: boolean }[] = [
    { key: "on", label: onLabel, active: value },
    { key: "off", label: offLabel, active: !value },
  ];

  return (
    <div className={styles.root} role="group" aria-label="전원 동작">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className={`${styles.option} ${opt.active ? styles.optionActive : ""} ${
            opt.key === "on" ? styles.optionOn : styles.optionOff
          }`.trim()}
          aria-pressed={opt.active}
          onClick={() => onChange(opt.key === "on")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
