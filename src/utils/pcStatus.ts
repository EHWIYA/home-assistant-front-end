import type { PcStatus } from "@/api/types";
import type { PcBootConfirmationState } from "./pcBootConfirmation";

export const PC_OFF_CONFIRM =
  "콘센트 전원을 끕니다. PC가 안전하게 종료되지 않을 수 있습니다.";

export const PC_WAKE_CONFIRM =
  "PC가 꺼져 있을 때 사용하세요. 이 동작은 깨우기 패킷만 보내며 콘센트를 켜거나 PC의 부팅을 확인하지 않습니다. 패킷을 보내시겠습니까?";

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

export function getPcNetworkStatusLabel(
  networkReachable: boolean,
  confirmation: PcBootConfirmationState,
): string {
  if (networkReachable || confirmation === "confirmed") {
    return "부팅/네트워크 확인됨";
  }
  if (confirmation === "polling") {
    return "패킷 전송됨 · 부팅/네트워크 확인 중…";
  }
  if (confirmation === "unconfirmed") {
    return "패킷 전송됨 · 부팅이 아직 확인되지 않았습니다.";
  }
  return "PC 네트워크 응답 없음";
}

export function requestPcToggle(
  action: "on" | "off",
  mutate: (action: "on" | "off") => void,
): void {
  if (action === "off" && !window.confirm(PC_OFF_CONFIRM)) return;
  mutate(action);
}

export function requestPcWake(mutate: () => void): void {
  if (!window.confirm(PC_WAKE_CONFIRM)) return;
  mutate();
}
