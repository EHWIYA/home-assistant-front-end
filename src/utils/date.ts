const KO_LOCALE = "ko-KR";

export function formatUpdatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(KO_LOCALE, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatExecutedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(KO_LOCALE, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}
