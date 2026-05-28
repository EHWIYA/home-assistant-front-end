import type { PcStatus } from "@/api/types";

export const PC_OFF_CONFIRM =
  "콘센트 전원을 끕니다. PC가 안전하게 종료되지 않을 수 있습니다.";

export function getPcStatusLabel(pc: PcStatus): string {
  if (pc.switch === "unavailable") return "제어 불가";
  if (pc.switch === "unknown") return "상태 알 수 없음";
  if (pc.switch === "off") return "콘센트 OFF";
  if (pc.estimated_running) return "PC 동작";
  return "대기/꺼짐 (콘센트 ON)";
}

export function isPcControllable(pc: PcStatus): boolean {
  return (
    pc.online &&
    pc.switch !== "unavailable" &&
    pc.switch !== "unknown"
  );
}

export function requestPcToggle(
  action: "on" | "off",
  mutate: (action: "on" | "off") => void,
): void {
  if (action === "off" && !window.confirm(PC_OFF_CONFIRM)) return;
  mutate(action);
}
