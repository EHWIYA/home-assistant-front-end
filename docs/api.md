# iot-api (프론트 연동)

공식 스키마는 FastAPI 자동 생성 문서를 따릅니다.

| 문서 | URL |
|------|-----|
| OpenAPI JSON | https://iot-api.iwhya.kr/openapi.json |
| Swagger UI | https://iot-api.iwhya.kr/docs |

타입 정의: [`src/api/types.ts`](../src/api/types.ts) · 에러 파싱: [`src/api/errors.ts`](../src/api/errors.ts)

## 인증

모든 `/api/v1/*` 요청에 `X-API-Key: <VITE_API_KEY>` (백엔드 `IOT_API_KEY` 와 동일).

## GET /api/v1/status/stream (SSE, OpenAPI 1.4.0+)

- `Content-Type: text/event-stream`
- 이벤트: `snapshot` 1회 후 `status` 지속 — payload는 GET `/api/v1/status` 와 동일 JSON
- EventSource 제약: `?api_key=<VITE_API_KEY>` 쿼리 인증 (REST 헤더와 동일 키)
- PWA: 연결 성공 시 status 폴링 중단, 실패·끊김·탭 hidden 시 폴링 fallback (visible 12s / hidden 60s)

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

PWA 대시보드는 이 값을 **「에어컨 가동 추정」** 으로만 표시합니다 (`ac_auto_*` 와 구분).

## GET /api/v1/status — `ac_auto_enabled` · `ac_auto_state` (OpenAPI 1.4.0+)

| 필드 | 타입 | 설명 |
|------|------|------|
| `ac_auto_enabled` | `boolean \| null` | HA `input_boolean.hwiya_ac_auto_enabled` — 자동 ON/OFF 마스터 |
| `ac_auto_state` | object \| null | 마지막 on/off 이력 (KST `YYYY-MM-DD HH:MM:SS`) |

`ac_auto_state`:

- `state`: `on` \| `off` \| `unknown` \| `unavailable`
- `last_on`, `last_off`, `last_transition`: string \| null — `00:00:00`·null 은 UI에서 「기록 없음」

제어: 수동은 기존 `POST /api/v1/ac`. 자동 마스터 토글 API는 2차(프론트 배지만 읽기 전용).

## GET /api/v1/status — `pc` (Tapo HWIYA-PC, OpenAPI 1.3.0+)

- 홈 플러그(`plug`)와 분리. PC 콘센트·전력은 `pc` 객체
- `switch`: `on` | `off` | `unavailable` | `unknown`
- `estimated_running`: `pc.power_w`가 임계값(기본 50W, `PC_POWER_THRESHOLD_W`) 이상이면 `true`
- `online`, `overload`, `wifi_signal_level` — UI 뱃지·경고

제어: `POST /api/v1/plug` 가 아닌 **`POST /api/v1/pc`**

## POST /api/v1/pc

- Body: `{ "action": "on" | "off" }`
- 200: `{ "ok": true, "switch": "on" | "off" }`
- OFF 시 PWA에서 안전 종료 미보장 안내(확인 모달)

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
