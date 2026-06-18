import { useMemo } from "react";
import type { SchedulePreviewOccurrence } from "@/api/types";
import {
  buildMonthGrid,
  formatDateKst,
  getCalendarDayTone,
  type MonthCell,
} from "@/utils/calendar";
import styles from "./ScheduleMonthCalendar.module.css";

interface ScheduleMonthCalendarProps {
  year: number;
  month: number;
  holidays: readonly string[];
  selectedWeekdays: number[];
  previewByDate?: ReadonlyMap<string, SchedulePreviewOccurrence[]>;
  onToggleWeekday: (weekday: number) => void;
  onMonthChange: (year: number, month: number) => void;
}

export function ScheduleMonthCalendar({
  year,
  month,
  holidays,
  selectedWeekdays,
  previewByDate,
  onToggleWeekday,
  onMonthChange,
}: ScheduleMonthCalendarProps) {
  const holidaySet = useMemo(() => new Set(holidays), [holidays]);
  const cells = useMemo(
    () => buildMonthGrid(year, month),
    [year, month],
  );

  function prevMonth() {
    if (month === 0) onMonthChange(year - 1, 11);
    else onMonthChange(year, month - 1);
  }

  function nextMonth() {
    if (month === 11) onMonthChange(year + 1, 0);
    else onMonthChange(year, month + 1);
  }

  return (
    <div className={styles.root}>
      <div className={styles.nav}>
        <button type="button" className={styles.navBtn} onClick={prevMonth}>
          ‹
        </button>
        <p className={styles.monthLabel}>
          {year}년 {month + 1}월
        </p>
        <button type="button" className={styles.navBtn} onClick={nextMonth}>
          ›
        </button>
      </div>

      <div className={styles.weekdayRow} aria-hidden>
        {["월", "화", "수", "목", "금", "토", "일"].map((label) => (
          <span key={label} className={styles.weekdayHead}>
            {label}
          </span>
        ))}
      </div>

      <div className={styles.grid} role="grid" aria-label="스케줄 요일 달력">
        {cells.map((cell) => (
          <CalendarCell
            key={cell.date}
            cell={cell}
            tone={getCalendarDayTone(cell.date, holidaySet)}
            selected={selectedWeekdays.includes(cell.weekday)}
            preview={previewByDate?.get(cell.date)}
            onToggleWeekday={onToggleWeekday}
          />
        ))}
      </div>

      <ul className={styles.legend}>
        <li>
          <span className={`${styles.swatch} ${styles.toneHoliday}`} />
          공휴일·일요일
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.toneSaturday}`} />
          토요일
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.toneWeekday}`} />
          평일
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.toneSelected}`} />
          선택 요일
        </li>
      </ul>
    </div>
  );
}

interface CalendarCellProps {
  cell: MonthCell;
  tone: ReturnType<typeof getCalendarDayTone>;
  selected: boolean;
  preview?: SchedulePreviewOccurrence[];
  onToggleWeekday: (weekday: number) => void;
}

function CalendarCell({
  cell,
  tone,
  selected,
  preview,
  onToggleWeekday,
}: CalendarCellProps) {
  const toneClass =
    tone === "holiday" || tone === "sunday"
      ? styles.toneHoliday
      : tone === "saturday"
        ? styles.toneSaturday
        : styles.toneWeekday;

  const hasPreview = Boolean(preview?.length);
  const today = formatDateKst(new Date()) === cell.date;

  return (
    <button
      type="button"
      role="gridcell"
      className={`${styles.cell} ${toneClass} ${
        !cell.inMonth ? styles.cellOutside : ""
      } ${selected ? styles.cellSelected : ""} ${
        hasPreview ? styles.cellHasPreview : ""
      } ${today ? styles.cellToday : ""}`.trim()}
      onClick={() => onToggleWeekday(cell.weekday)}
      aria-pressed={selected}
      aria-label={`${cell.day}일`}
    >
      <span className={styles.cellDay}>{cell.day}</span>
      {hasPreview ? (
        <span className={styles.previewDot} aria-hidden />
      ) : null}
    </button>
  );
}
