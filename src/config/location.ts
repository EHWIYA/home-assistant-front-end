/** iot-api GET /api/v1/weather/local 캐시·갱신 (서버 TTL 15분과 동일) */
export const LOCAL_WEATHER_REFETCH_MS = 15 * 60 * 1000;

export const LOCAL_WEATHER_STALE_MS = 10 * 60 * 1000;

/** 로딩·오류 문구 fallback — API 미수신 시 */
export const LOCAL_WEATHER_SHORT_LABEL = "가산동";
