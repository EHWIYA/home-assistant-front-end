# iot-api (프론트 연동)

공식 스키마는 FastAPI 자동 생성 문서를 따릅니다.

| 문서 | URL |
|------|-----|
| OpenAPI JSON | https://iot-api.iwhya.kr/openapi.json |
| Swagger UI | https://iot-api.iwhya.kr/docs |

타입 정의: [`src/api/types.ts`](../src/api/types.ts) · 에러 파싱: [`src/api/errors.ts`](../src/api/errors.ts)

## 인증

모든 `/api/v1/*` 요청에 `X-API-Key: <VITE_API_KEY>` (백엔드 `IOT_API_KEY` 와 동일).

## POST /api/v1/ac

- Body: `{ "action": "on" | "off" }`
- 200: `{ "ok": true }` (plug 응답과 달리 `switch` 없음)
- 4xx `detail`:
  - 401/502/503/504: `{ "detail": { "detail": "<메시지>", "code": "<코드>" } }`
  - 422: `{ "detail": [ { "type", "loc", "msg", ... } ] }` (FastAPI 표준)

## GET /api/v1/status — `ac_estimated_running`

- `boolean` — 스마트플러그 전력(`plug.power_w`, HA `sensor.hwiya_home_power`)이 임계값(기본 50W) 이상이면 `true`
- `plug.power_w`가 `null`이면 `false`
- 실제 AC 전원/IR 상태가 아님. 제어는 `POST /api/v1/ac` 별도

PWA 대시보드는 이 값을 **「가동 추정」** 으로만 표시합니다.

## GET /api/v1/strip/state

- 200: `device_id`, `online`, `channels[]` (`channel` 1–4, `on` boolean|null, `label`), `updated_at`
- `on: null` — 상태 미확정, UI에서 별도 표시

## POST /api/v1/strip/channels/{1-4}

- Body: `{ "on": true | false }`
- 200: 최신 strip state (GET state와 동일 스키마)

## GET /health

- `db_reachable` 등 (설정 화면에서 표시, mock 모드 제외)

## 스케줄 `/api/v1/schedules`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/v1/schedules` | 목록 |
| POST | `/api/v1/schedules` | 생성 (201) |
| PATCH | `/api/v1/schedules/{id}` | 수정 |
| DELETE | `/api/v1/schedules/{id}` | 삭제 (204) |
| GET | `/api/v1/schedules/{id}/runs?limit=50` | 실행 이력 (선택) |

생성 body 예 (`action_type: "channel"`):

```json
{
  "name": "아침 콘센트",
  "enabled": true,
  "action_type": "channel",
  "channel_number": 1,
  "channel_on": true,
  "time_kst": "08:00",
  "days_of_week": [0, 1, 2, 3, 4]
}
```

- `days_of_week`: 0=월 … 6=일
- `action_type: "preset"` — 프리셋 UI는 DB 시드 전까지 미노출

### 오류 code (예)

| code | HTTP |
|------|------|
| `unauthorized` | 401 |
| `strip_not_configured` | 503 |
| `hejhome_*` | 4xx/5xx |
