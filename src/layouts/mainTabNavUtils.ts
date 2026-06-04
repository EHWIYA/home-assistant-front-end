import type { MouseEvent } from "react";
import type { MainTabConfig } from "@/routes/tabs";
import type { NavigateFunction } from "react-router-dom";

export function isTabRootPath(tab: MainTabConfig, pathname: string): boolean {
  if (tab.to === "/") {
    return pathname === "/";
  }
  return pathname === tab.to;
}

/** 탭 전환은 replace — 브라우저 뒤로가기가 탭 이동을 되돌리지 않음 */
export function handleMainTabClick(
  tab: MainTabConfig,
  pathname: string,
  navigate: NavigateFunction,
  event: MouseEvent<HTMLAnchorElement>,
): void {
  if (isTabRootPath(tab, pathname)) {
    return;
  }
  const onTabBranch =
    tab.to === "/"
      ? false
      : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
  if (!onTabBranch) {
    return;
  }
  event.preventDefault();
  void navigate(tab.to, { replace: true });
}
