/** 플러그·PC 전력 표시 (W). null이면 미수신. */
export function formatPowerW(w: number | null): string {
  if (w == null) return "—";
  return `${Math.round(w)} W`;
}
