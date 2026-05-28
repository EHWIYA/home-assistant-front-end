import type { StatusResponse } from "@/api/types";
import { formatUpdatedAt } from "@/utils/date";
import { formatRateWonPerKwh } from "@/utils/electricity";
import styles from "./statusPage.module.css";

interface StatusFooterProps {
  data: StatusResponse;
}

export function StatusFooter({ data }: StatusFooterProps) {
  const rate = data.electricity?.rate_won_per_kwh;

  return (
    <p className={styles.updated}>
      갱신: {formatUpdatedAt(data.updated_at)}
      {rate != null ? ` · 단가 ${formatRateWonPerKwh(rate)}` : ""}
    </p>
  );
}
