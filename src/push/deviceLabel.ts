/** NAS register API `label` 필드 — 기기 구분용 */
export function getPushDeviceLabel(): string {
  if (typeof navigator === "undefined") {
    return "web";
  }
  const ua = navigator.userAgent;
  if (/iPhone|iPod/.test(ua)) return "iphone";
  if (/iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return "ipad";
  }
  if (/Android/i.test(ua)) return "android";
  return "web";
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}
