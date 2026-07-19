import { ApiError } from "@/api/http";

export function formatApiError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === "unauthorized") {
      return "API 키가 올바르지 않습니다. 설정·배포의 VITE_API_KEY를 확인하세요.";
    }
    if (error.code === "strip_not_configured") {
      return "멀티탭 서비스가 아직 설정되지 않았습니다. 백엔드 설정을 확인하세요.";
    }
    if (error.code === "ac_auto_toggle_failed") {
      return "자동제어 상태 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    }
    if (error.code === "ac_auto_plug_sync_failed") {
      return "자동제어는 변경되었지만 플러그 동기화에 실패했습니다. 상태를 확인해 주세요.";
    }
    if (error.code === "ac_auto_plug_state_mismatch") {
      return "자동제어와 플러그 상태가 일치하지 않습니다. 새로고침 후 다시 시도해 주세요.";
    }
    if (error.code === "plug_cut_unsafe") {
      return "먼저 리모컨(IR)으로 에어컨을 끈 뒤, soft-off 확인 후 콘센트를 끄세요.";
    }
    if (error.code?.startsWith("hejhome_")) {
      return `헤이홈 연동 오류: ${error.message}`;
    }
    if (error.status >= 500) {
      return `서버 오류 (${error.status}): ${error.message}`;
    }
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
