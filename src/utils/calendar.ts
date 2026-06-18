/** KST 기준 YYYY-MM-DD */
export function formatDateKst(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKst(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** API days_of_week: 0=월 … 6=일 */
export function weekdayIndexFromDate(date: Date): number {
  const js = date.getDay();
  return js === 0 ? 6 : js - 1;
}

export interface MonthCell {
  date: string;
  day: number;
  inMonth: boolean;
  weekday: number;
}

export function buildMonthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1);
  const startPad = weekdayIndexFromDate(first);
  const gridStart = new Date(year, month, 1 - startPad);
  const cells: MonthCell[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i,
    );
    cells.push({
      date: formatDateKst(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      weekday: weekdayIndexFromDate(d),
    });
  }

  return cells;
}

export type CalendarDayTone = "holiday" | "sunday" | "saturday" | "weekday";

export function getCalendarDayTone(
  date: string,
  holidaySet: ReadonlySet<string>,
): CalendarDayTone {
  if (holidaySet.has(date)) return "holiday";
  const js = parseDateKst(date).getDay();
  if (js === 0) return "sunday";
  if (js === 6) return "saturday";
  return "weekday";
}

export function addDaysKst(date: string, days: number): string {
  const d = parseDateKst(date);
  d.setDate(d.getDate() + days);
  return formatDateKst(d);
}

export function startOfMonthKst(year: number, month: number): string {
  return formatDateKst(new Date(year, month, 1));
}

export function endOfMonthKst(year: number, month: number): string {
  return formatDateKst(new Date(year, month + 1, 0));
}
