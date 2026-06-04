export type PwaDisplayMode = "standalone" | "browser";

/** PWA(홈 화면 추가)로 실행 중인지 — iOS `navigator.standalone` 포함 */
export function getPwaDisplayMode(): PwaDisplayMode {
  if (typeof window === "undefined") {
    return "browser";
  }
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return "standalone";
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) {
    return "standalone";
  }
  return "browser";
}
