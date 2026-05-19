/** OpenAPI: https://iot-api.iwhya.kr/openapi.json */

/** POST /api/v1/plug · /api/v1/ac body `action` */
export type OnOffAction = "on" | "off";

/** @deprecated Prefer {@link OnOffAction} */
export type PlugSwitch = OnOffAction;

export interface OkResponse {
  ok: true;
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
}

export interface PersonStatus {
  state: string;
  latitude: number;
  longitude: number;
}

export interface WeatherOutdoor {
  temperature: number;
  humidity: number;
}

export interface StatusResponse {
  plug: PlugStatus;
  /**
   * 스마트플러그 전력(`plug.power_w`)이 임계값(기본 50W) 이상이면 true.
   * `power_w`가 null이면 false. 실제 AC 전원/IR 상태가 아님.
   */
  ac_estimated_running: boolean;
  person: PersonStatus;
  indoor: { temperature: number; humidity: number } | null;
  weather_outdoor: WeatherOutdoor | null;
  updated_at: string;
}

export interface PlugActionRequest {
  action: OnOffAction;
}

export interface AcActionRequest {
  action: OnOffAction;
}
