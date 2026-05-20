import { ApiError } from "@/api/http";

export function formatApiError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === "unauthorized") {
      return "API 키가 올바르지 않습니다. 설정·배포의 VITE_API_KEY를 확인하세요.";
    }
    if (error.code === "strip_not_configured") {
      return "멀티탭 서비스가 아직 설정되지 않았습니다. 백엔드 설정을 확인하세요.";
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
