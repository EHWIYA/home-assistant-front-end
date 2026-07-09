/** PWA App Badge API — 미지원 브라우저는 no-op */
export async function syncAppBadgeCount(count: number): Promise<void> {
  if (!("setAppBadge" in navigator)) {
    return;
  }

  try {
    if (count <= 0) {
      await navigator.clearAppBadge();
    } else {
      await navigator.setAppBadge(count);
    }
  } catch {
    // 권한·플랫폼 제한
  }
}
