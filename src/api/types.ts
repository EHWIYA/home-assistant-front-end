export type PlugSwitch = "on" | "off";

export interface PlugStatus {
  switch: PlugSwitch;
  power_w: number;
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
  ac_estimated_running: boolean;
  person: PersonStatus;
  indoor: { temperature: number; humidity: number } | null;
  weather_outdoor: WeatherOutdoor | null;
  updated_at: string;
}

export interface PlugActionRequest {
  action: PlugSwitch;
}
