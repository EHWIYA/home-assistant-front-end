/** 앱 내 경로 — Link·navigate·Route path는 여기만 참조 */

export const paths = {
  home: "/",
  ac: "/ac",
  pc: "/pc",
  settings: "/settings",
  strip: "/strip",
  stripSchedules: "/strip/schedules",
  stripSchedulesNew: "/strip/schedules/new",
  stripScheduleEdit: (id: string) =>
    `/strip/schedules/${encodeURIComponent(id)}/edit`,
} as const;

export type AppPath =
  | (typeof paths)[Exclude<keyof typeof paths, "stripScheduleEdit">]
  | ReturnType<typeof paths.stripScheduleEdit>;
