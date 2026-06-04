import { useMatches, type UIMatch } from "react-router-dom";
import { BRAND } from "@/config/brand";

/** Route `handle` — 헤더 부제·탭바 표시 */
export interface AppRouteHandle {
  pageTitle: string;
  /** true면 하단 메인 탭바 숨김 (스케줄 폼 등) */
  hideTabBar?: boolean;
}

export function isAppRouteHandle(
  handle: unknown,
): handle is AppRouteHandle {
  return (
    typeof handle === "object" &&
    handle !== null &&
    "pageTitle" in handle &&
    typeof (handle as AppRouteHandle).pageTitle === "string"
  );
}

export function getPageTitleFromMatches(
  matches: UIMatch[],
  fallback = BRAND.tagline,
): string {
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i].handle;
    if (isAppRouteHandle(handle)) {
      return handle.pageTitle;
    }
  }
  return fallback;
}

export function shouldHideTabBar(matches: UIMatch[]): boolean {
  return matches.some(
    (m) => isAppRouteHandle(m.handle) && m.handle.hideTabBar === true,
  );
}

export function useAppRouteHandle(): {
  pageTitle: string;
  hideTabBar: boolean;
} {
  const matches = useMatches();
  return {
    pageTitle: getPageTitleFromMatches(matches),
    hideTabBar: shouldHideTabBar(matches),
  };
}
