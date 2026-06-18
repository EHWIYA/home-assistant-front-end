/** 앱 내 경로 — Link·navigate·Route path는 여기만 참조 */

export const paths = {
  home: "/",
  ac: "/ac",
  pc: "/pc",
  settings: "/settings",
  strip: "/strip",
  stripChannelSchedules: (channel: number) =>
    `/strip/channels/${channel}/schedules`,
  stripChannelSchedulesNew: (channel: number) =>
    `/strip/channels/${channel}/schedules/new`,
  stripChannelScheduleEdit: (channel: number, id: string) =>
    `/strip/channels/${channel}/schedules/${encodeURIComponent(id)}/edit`,
  /** @deprecated 채널 1로 리다이렉트 — 신규 경로는 stripChannelSchedules 사용 */
  stripSchedules: "/strip/schedules",
  stripSchedulesNew: "/strip/schedules/new",
  stripScheduleEdit: (id: string) =>
    `/strip/schedules/${encodeURIComponent(id)}/edit`,
  mood: "/mood",
} as const;

export type AppPath =
  | (typeof paths)[Exclude<keyof typeof paths, "stripScheduleEdit">]
  | ReturnType<typeof paths.stripScheduleEdit>;
