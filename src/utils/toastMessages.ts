export const TOAST_GUIDE = {
  retry: "다시 시도해 주세요.",
  syncRetry: "장치 상태 동기화 중입니다. 잠시 후 다시 시도해 주세요.",
  deleteRetry: "삭제 요청을 확인하고 다시 시도해 주세요.",
  saveRetry: "입력값을 확인하고 다시 저장해 주세요.",
  checkNetworkAndApi: "네트워크 및 API 상태를 확인한 뒤 다시 시도해 주세요.",
  checkNetworkAndApiConfig:
    "네트워크 및 API 설정을 확인한 뒤 다시 시도해 주세요.",
  backToListAndRetry: "목록 화면으로 이동해 다시 시도해 주세요.",
} as const;

export const TOAST_RESOURCE = {
  status: "상태",
  acStatus: "에어컨 상태",
  stripStatus: "멀티탭 상태",
  moodMeta: "무드등 정보",
  moodCapabilities: "무드등 기능",
  moodState: "무드등 상태",
  schedules: "스케줄",
  schedulesList: "스케줄 목록",
  scheduleRuns: "실행 이력",
} as const;

export const TOAST_DEVICE = {
  ac: "에어컨",
  plug: "플러그",
  pc: "PC",
  strip: "멀티탭",
  mood: "무드등",
  schedule: "스케줄",
} as const;

export const TOAST_COMMAND = {
  sent: "명령을 보냈습니다",
} as const;
