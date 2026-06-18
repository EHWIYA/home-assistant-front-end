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
  previewByDate?: ReadonlyMap<string, SchedulePreviewOccurrence[]>;
  onMonthChange: (year: number, month: number) => void;
}

export function ScheduleMonthCalendar({
  year,
  month,
  holidays,
  previewByDate,
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
        <button
          type="button"
          className={styles.navBtn}
          onClick={prevMonth}
          aria-label="이전 달"
        >
          ‹
        </button>
        <p className={styles.monthLabel}>
          {year}년 {month + 1}월
        </p>
        <button
          type="button"
          className={styles.navBtn}
          onClick={nextMonth}
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      <div className={styles.weekdayRow} aria-hidden>
        {["월", "화", "수", "목", "금", "토", "일"].map((label, i) => (
          <span
            key={label}
            className={`${styles.weekdayHead} ${
              i === 5 ? styles.weekdaySat : i === 6 ? styles.weekdaySun : ""
            }`.trim()}
          >
            {label}
          </span>
        ))}
      </div>

      <div className={styles.grid} role="grid" aria-label="스케줄 미리보기 달력">
        {cells.map((cell) => (
          <CalendarCell
            key={cell.date}
            cell={cell}
            tone={getCalendarDayTone(cell.date, holidaySet)}
            preview={previewByDate?.get(cell.date)}
          />
        ))}
      </div>

      <p className={styles.footnote}>
        <span className={styles.previewMark} aria-hidden />
        실행 예정
      </p>
    </div>
  );
}

interface CalendarCellProps {
  cell: MonthCell;
  tone: ReturnType<typeof getCalendarDayTone>;
  preview?: SchedulePreviewOccurrence[];
}

function CalendarCell({ cell, tone, preview }: CalendarCellProps) {
  const hasPreview = Boolean(preview?.length);
  const today = formatDateKst(new Date()) === cell.date;

  const dayClass =
    tone === "holiday" || tone === "sunday"
      ? styles.daySun
      : tone === "saturday"
        ? styles.daySat
        : "";

  return (
    <div
      role="gridcell"
      className={`${styles.cell} ${!cell.inMonth ? styles.cellOutside : ""} ${
        hasPreview ? styles.cellHasPreview : ""
      } ${today ? styles.cellToday : ""}`.trim()}
      aria-label={
        hasPreview
          ? `${cell.day}일, 실행 ${preview!.length}건`
          : `${cell.day}일`
      }
    >
      <span className={`${styles.cellDay} ${dayClass}`.trim()}>{cell.day}</span>
      {hasPreview ? (
        <span className={styles.previewMark} aria-hidden />
      ) : null}
    </div>
  );
}
