/** HA mutex 한 줄 → 사용자용 짧은 설명 */
export function formatMutexLineForUser(line: string): string {
  const trimmed = line.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("manual")) {
    return "수동 — 자동·외출이 꺼집니다.";
  }
  if (lower.startsWith("auto")) {
    return "자동 — 집에서 온도·습도에 맞춰 동작합니다.";
  }
  if (lower.startsWith("away")) {
    return "외출 — 외출 조건에 맞춰 동작합니다.";
  }
  return trimmed.replace(/\s*—\s*HA.*$/i, "").trim();
}

export function splitMutexLines(mutex: string): string[] {
  return mutex
    .split(/\s*\|\s*/)
    .map((line) => line.trim())
    .filter(Boolean);
}
