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
