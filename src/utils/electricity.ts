/** 추정 요금(원). null·undefined면 미표시용 "—". */
export function formatEstimatedCostWon(won: number | null | undefined): string {
  if (won == null) return "—";
  return `${won.toLocaleString("ko-KR")}원`;
}

/** status.electricity.rate_won_per_kwh */
export function formatRateWonPerKwh(rate: number | null | undefined): string {
  if (rate == null) return "—";
  const formatted = rate.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  return `${formatted}원/kWh`;
}
