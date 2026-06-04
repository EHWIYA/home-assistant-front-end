/** OpenAPI: https://iot-api.iwhya.kr/openapi.json */

/** POST /api/v1/plug · /api/v1/pc body `action` */
export type OnOffAction = "on" | "off";

/** GET /api/v1/status → pc.switch */
export type PcSwitchState = OnOffAction | "unavailable" | "unknown";

/** @deprecated Prefer {@link OnOffAction} */
export type PlugSwitch = OnOffAction;

export interface OkResponse {
  ok: true;
}

/** POST /api/v1/ac 응답 */
export interface AcActionResponse {
  ok: boolean;
  request_id?: string | null;
  applied_mode?: AcMode | null;
  power?: "on" | "off" | null;
  auto_enabled?: boolean | null;
  away_enabled?: boolean | null;
  partial_failure?: boolean;
  error?: string | null;
}

/** 401/502/503/504 — nested detail */
export interface ApiErrorDetail {
  detail: string;
  code: string;
}

/** 422 — FastAPI validation error item */
export interface ValidationErrorItem {
  type: string;
  loc: (string | number)[];
  msg: string;
  input?: unknown;
}

export type ApiErrorPayload =
  | { detail: string }
  | { detail: ApiErrorDetail }
  | { detail: ValidationErrorItem[] };

export interface PlugStatus {
  switch: OnOffAction;
  /** null이면 전력 미수신 — status의 ac_estimated_running은 false */
  power_w: number | null;
  energy_kwh: number;
  /** 누적 사용량 기준 요금(원). null이면 미산출 */
  estimated_cost_won: number | null;
}

/** GET /api/v1/status → pc (Tapo HWIYA-PC) */
export interface PcStatus {
  switch: PcSwitchState;
  power_w: number;
  energy_today_kwh: number;
  energy_month_kwh: number;
  online: boolean;
  wifi_signal_level: number;
  overload: boolean;
  /** power_w >= PC_POWER_THRESHOLD_W(기본 50W) */
  estimated_running: boolean;
  /** 오늘·이번 달 사용량 기준 요금(원). null이면 미산출 */
  estimated_cost_today_won: number | null;
  estimated_cost_month_won: number | null;
}

/** GET /api/v1/status → electricity (요금 단가) */
export interface ElectricityStatus {
  rate_won_per_kwh: number;
}

export interface WeatherOutdoor {
  temperature: number;
  humidity: number;
  /** HA weather.forecast_jib 등 — 영문/HA 표기. 기상청 실외 날씨 아님 */
  condition?: string | null;
}

/** GET /api/v1/weather/local — 공공데이터 기상청 (홈 PWA) OpenAPI 1.6.0+ */
export interface WeatherLocalResponse {
  location_label: string;
  location_short_label: string;
  temperature: number;
  humidity: number;
  condition: string;
  condition_code?: string | null;
  observed_at: string;
  source?: string | null;
  source_detail?: string | null;
}

/** GET /api/v1/status — Broadlink 실내 센서 (°C, %) */
export interface IndoorClimate {
  temperature: number;
  humidity: number;
}

/** GET /api/v1/status → ac_auto_state.state (HA 자동제어 마지막 전환 방향) */
export type AcAutoSwitchState =
  | "on"
  | "off"
  /** 초기·placeholder — 실서비스는 전환 후 on/off만 */
  | "unknown"
  | "unavailable";

/** GET /api/v1/status → ac_auto_state (KST `YYYY-MM-DD HH:MM:SS`) */
export interface AcAutoState {
  state: AcAutoSwitchState;
  last_on: string | null;
  last_off: string | null;
  last_transition: string | null;
}

export interface StatusResponse {
  plug: PlugStatus;
  /** Tapo HWIYA-PC — OpenAPI 1.3.0+ */
  pc?: PcStatus;
  /** 요금 단가(원/kWh). 없으면 요금은 미표시 */
  electricity?: ElectricityStatus;
  /**
   * 스마트플러그 전력(`plug.power_w`)이 임계값(기본 50W) 이상이면 true.
   * `power_w`가 null이면 false. 실제 AC 전원/IR 상태가 아님.
   */
  ac_estimated_running: boolean;
  /**
   * HA `input_boolean.hwiya_ac_auto_enabled` — 자동 ON/OFF 마스터.
   * `null`: 엔티티 없음/비정상. 변경 API는 2차(읽기 전용 배지).
   */
  ac_auto_enabled?: boolean | null;
  /** HA 외출 스마트 모드 — OpenAPI 1.5.0+ */
  ac_away_enabled?: boolean | null;
  /** HA `input_select.hwiya_ac_mode` — OpenAPI 1.5.0+ */
  ac_mode?: AcMode | null;
  /** mode=auto 가동 중 실제 IR 모드(cool/dry) — OpenAPI 1.5.0+ */
  ac_last_run_mode?: AcLastRunMode | null;
  /** 자동·수동 전환 이력. `null`: 미연동/비정상 */
  ac_auto_state?: AcAutoState | null;
  indoor: IndoorClimate | null;
  weather_outdoor: WeatherOutdoor | null;
  updated_at: string;
}

export interface PlugActionRequest {
  action: OnOffAction;
}

export type AcLastRunMode = "cool" | "dry";

export interface AcActionRequest {
  mode: AcMode;
  /** HA 자동 ON/OFF 마스터 — 미전송 시 유지 */
  auto_enabled?: boolean | null;
  /** 외출 스마트 모드 — 미전송 시 유지 */
  away_enabled?: boolean | null;
}

export interface AcAutoToggleRequest {
  enabled: boolean;
}

export interface AcAutoToggleResponse {
  ok: boolean;
  request_id?: string;
  auto_enabled?: boolean | null;
  plug_switch?: OnOffAction | null;
  error?: string | null;
}

export type AcMode = "off" | "auto" | "cool" | "dry";

export interface AcStateResponse {
  temperature: number;
  humidity: number;
  mode: AcMode;
  /** HA 자동 ON/OFF 마스터 */
  auto_enabled: boolean;
  /** HA 외출 스마트 모드 */
  away_enabled: boolean;
  /** mode=auto·가동 중 마지막 cool/dry */
  last_run_mode?: AcLastRunMode | null;
  /** API 합성 가동 여부 (플러그·IR·ac_auto_state 종합) */
  power?: "on" | "off";
  /** 가동 판단 근거 — plug(≥50W), logical(저전력 IR 등) */
  running_source?: string;
  /** 백엔드 정합성 판정 결과 (power/mode/ac_auto_state 종합) */
  state_consistent?: boolean;
  /** 정합성 판정에 사용된 주 소스 설명 */
  state_source?: string;
  /** 마지막 제어 시각 (KST 문자열 또는 ISO), 없으면 null */
  last_control_at?: string | null;
  /** 마지막 제어 결과 */
  last_control_result?: "success" | "failed" | null;
}

export interface PcActionRequest {
  action: OnOffAction;
}

export interface PcActionResponse {
  ok: true;
  switch: OnOffAction;
}

/** GET /api/v1/strip/state · POST /api/v1/strip/channels/{n} */
export type StripChannelNumber = 1 | 2 | 3 | 4;

export interface StripChannel {
  channel: StripChannelNumber;
  on: boolean | null;
  label: string | null;
}

export interface StripStateResponse {
  device_id: string;
  online: boolean;
  channels: StripChannel[];
  updated_at: string;
}

export interface StripChannelControlBody {
  on: boolean;
}

/** GET /health */
export interface HealthResponse {
  status?: string;
  db_reachable?: boolean;
}

export type ScheduleActionType = "channel" | "preset";

export interface Schedule {
  id: string;
  name: string;
  enabled: boolean;
  action_type: ScheduleActionType;
  channel_number?: number | null;
  channel_on?: boolean | null;
  preset_name?: string | null;
  time_kst: string;
  days_of_week: number[];
  created_at?: string;
  updated_at?: string;
}

export interface ScheduleCreateBody {
  name: string;
  enabled?: boolean;
  action_type: "channel";
  channel_number: StripChannelNumber;
  channel_on: boolean;
  time_kst: string;
  days_of_week: number[];
}

export type SchedulePatchBody = Partial<ScheduleCreateBody> & {
  enabled?: boolean;
};

export interface ScheduleRun {
  id?: string;
  schedule_id?: string;
  executed_at: string;
  success: boolean;
  detail?: string | null;
}

export interface ScheduleRunsResponse {
  runs: ScheduleRun[];
}
