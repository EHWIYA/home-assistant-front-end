import type { StatusResponse } from "@/api/types";
import { formatUpdatedAt } from "@/utils/date";
import styles from "./statusPage.module.css";

interface StatusFooterProps {
  data: StatusResponse;
}

export function StatusFooter({ data }: StatusFooterProps) {
  return (
    <p className={styles.updated}>
      갱신: {formatUpdatedAt(data.updated_at)}
      {data.person.state ? ` · ${data.person.state}` : ""}
    </p>
  );
}
