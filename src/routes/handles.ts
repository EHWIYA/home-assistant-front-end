import type { AppRouteHandle } from "@/routes/handle";

/** Route `handle` 상수 — App.tsx와 동일 문구 유지 */
export const routeHandles = {
  home: { pageTitle: "홈" } satisfies AppRouteHandle,
  ac: { pageTitle: "에어컨" } satisfies AppRouteHandle,
  pc: { pageTitle: "PC" } satisfies AppRouteHandle,
  settings: { pageTitle: "설정" } satisfies AppRouteHandle,
  strip: { pageTitle: "멀티탭" } satisfies AppRouteHandle,
  stripSchedules: { pageTitle: "스케줄" } satisfies AppRouteHandle,
  stripChannelSchedules: { pageTitle: "채널 스케줄" } satisfies AppRouteHandle,
  stripScheduleNew: {
    pageTitle: "새 스케줄",
    hideTabBar: true,
  } satisfies AppRouteHandle,
  stripChannelScheduleNew: {
    pageTitle: "새 스케줄",
    hideTabBar: true,
  } satisfies AppRouteHandle,
  stripScheduleEdit: {
    pageTitle: "스케줄 수정",
    hideTabBar: true,
  } satisfies AppRouteHandle,
  stripChannelScheduleEdit: {
    pageTitle: "스케줄 수정",
    hideTabBar: true,
  } satisfies AppRouteHandle,
  mood: { pageTitle: "무드등" } satisfies AppRouteHandle,
} as const;
