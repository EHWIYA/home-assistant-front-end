import { useSyncExternalStore } from "react";

/** 탭이 보일 때 status·strip 폴링 간격 (ms). */
export const POLLING_INTERVAL_VISIBLE_MS = 12_000;
/** 탭이 숨겨졌을 때 폴링 간격 (ms). */
export const POLLING_INTERVAL_HIDDEN_MS = 60_000;
export const POLLING_STALE_TIME_MS = 8_000;

function subscribeVisibility(onStoreChange: () => void) {
  document.addEventListener("visibilitychange", onStoreChange);
  return () => document.removeEventListener("visibilitychange", onStoreChange);
}

function getVisibilitySnapshot(): DocumentVisibilityState {
  return document.visibilityState;
}

function getVisibilityServerSnapshot(): DocumentVisibilityState {
  return "visible";
}

/** document.visibilityState 기준 visible 12s / hidden 60s. */
export function usePollingIntervalMs(): number {
  const state = useSyncExternalStore(
    subscribeVisibility,
    getVisibilitySnapshot,
    getVisibilityServerSnapshot,
  );
  return state === "hidden"
    ? POLLING_INTERVAL_HIDDEN_MS
    : POLLING_INTERVAL_VISIBLE_MS;
}
