# 푸시 알림 API — 백엔드(NAS) 공조 요청

**발신:** 프론트엔드 팀  
**수신:** 백엔드 / NAS API 담당  
**목적:** Web Push 고도화(Phase 4~6)에 필요한 REST API 스펙 합의

---

## 배경

프론트엔드에서 FCM Web Push 수신·로컬 알림함(IndexedDB)·미읽음 배지·설정 UI까지 구현을 완료했습니다.  
아래 **신규 API 4종**은 클라이언트에 graceful fallback(404/501 시 안내 문구)을 넣어 두었으며, NAS 쪽 구현이 완료되면 자동으로 활성화됩니다.

**기존 API (변경 없음)**

| Method | Path | Body | 인증 |
|--------|------|------|------|
| POST | `/api/push/register` | `{ token, label, enabled: true }` | `Bearer VITE_API_KEY` |
| DELETE | `/api/push/unregister` | `{ token }` | 동일 |

- `label`: `iphone` / `ipad` / `android` / `web` (클라이언트 `deviceLabel.ts` 기준)
- Base URL: `https://iot.iwhya.kr` (nginx 프록시 전제, IoT REST `iot-api.iwhya.kr`와 별도)

---

## 1. 등록 기기 목록 — `GET /api/push/tokens`

**용도:** 설정 화면에서 NAS에 등록된 FCM 토큰 목록 표시, 원격 해제

**Response 200**

```json
{
  "ok": true,
  "tokens": [
    {
      "token": "fcm-token-string",
      "label": "web",
      "enabled": true,
      "registeredAt": "2026-07-09T00:00:00.000Z",
      "lastSeenAt": "2026-07-09T12:00:00.000Z"
    }
  ]
}
```

- `registeredAt`, `lastSeenAt`는 ISO 8601 (선택)
- 미구현 시 **404 또는 501** — 프론트는 "API 준비 중" 안내

**원격 해제:** 기존 `DELETE /api/push/unregister` 재사용 (`{ token }`)

---

## 2. 테스트 푸시 — `POST /api/push/test`

**용도:** 설정에서 "테스트 푸시" 버튼 — 현재 Bearer 토큰(또는 요청 기기)으로 1건 발송

**Request**

```json
{}
```

**Response 200**

```json
{ "ok": true }
```

- 실제 FCM 발송은 NAS의 Firebase 서비스 계정 JSON 사용 (GitHub Secret 금지, NAS 로컬만)
- 12시간 발송 제한은 **테스트는 제외**할지 여부 결정 필요 (권장: 테스트는 제한 없음)

---

## 3. 발송 상태 — `GET /api/push/status`

**용도:** 설정 UI "다음 발송 가능 시각" / "마지막 발송" 표시

**Response 200**

```json
{
  "ok": true,
  "enabled": true,
  "lastSentAt": "2026-07-09T06:00:00.000Z",
  "nextAllowedAt": "2026-07-09T18:00:00.000Z"
}
```

- 12시간 1회 제한은 **NAS에서 enforcement** (프론트는 UI 문구만)
- 필드 모두 선택 — 없으면 프론트 해당 줄 미표시

---

## 4. 알림 히스토리 — `GET /api/push/history?limit=30`

**용도:** 기기 간 알림 동기화 (Phase 6). IndexedDB는 오프라인 캐시, 서버가 source of truth

**Response 200**

```json
{
  "ok": true,
  "alerts": [
    {
      "id": "server-uuid-or-seq",
      "fingerprint": "stable-issue-fingerprint",
      "title": "에어컨 이상",
      "body": "…",
      "receivedAt": "2026-07-09T06:00:00.000Z",
      "topic": "ac-anomaly",
      "url": "/alerts/abc123",
      "issueId": "issue-1",
      "status": "warn",
      "overall": "fail",
      "checkedAtKst": "2026-07-09 15:00 KST",
      "llmEscalate": "false",
      "summary": "[{\"name\":\"온도\",\"status\":\"fail\"}]"
    }
  ]
}
```

**병합 규칙 (프론트)**

- `fingerprint` 기준 dedup
- 로컬 `readAt` 유지 (서버에 읽음 상태 없을 때)
- `summary`는 FCM `data.summary`와 동일 JSON 문자열

---

## FCM payload 필드 (발송 측 참고)

NAS → FCM 발송 시 `data` 필드 권장:

| 필드 | 설명 |
|------|------|
| `fingerprint` | **필수** — 알림함·dedup 키 |
| `title`, `body` | 알림 제목·본문 |
| `topic` | `ac-anomaly`, `pc-offline`, `strip` 등 — 앱 내 라우팅 |
| `url` | 앱 내 경로 (예: `/ac`, `/alerts/{fp}`) — 있으면 우선 |
| `summary` | active checks JSON string |
| `issue_id`, `status`, `overall`, `checked_at_kst`, `llm_escalate` | 상세 UI |

**알림 클릭 네비게이션 우선순위 (프론트/SW 공통)**

1. `data.url` (앱 내 path 또는 절대 URL의 pathname)
2. `topic` 기본 경로 (`pc`→`/pc`, `strip`→`/strip`, `ac`→`/ac`)
3. `/alerts/{fingerprint}`

---

## 인증·CORS

- 모든 push API: `Authorization: Bearer {VITE_API_KEY}` (= 백엔드 `IOT_API_KEY`)
- Origin: `https://iot.iwhya.kr` (PWA)
- OPTIONS preflight 지원 필요

---

## 일정 제안

| 우선순위 | API | 이유 |
|----------|-----|------|
| P1 | `GET /api/push/status` | 12시간 제한 UX |
| P1 | `POST /api/push/test` | 운영 검증 |
| P2 | `GET /api/push/tokens` | 다기기 관리 |
| P2 | `GET /api/push/history` | 기기 간 동기화 |

---

## 문의

프론트 구현 파일: `src/push/api.ts`, `src/push/alertServerSync.ts`  
환경 변수 override: `VITE_PUSH_TOKENS_URL`, `VITE_PUSH_TEST_URL`, `VITE_PUSH_STATUS_URL`, `VITE_PUSH_HISTORY_URL`

합의 후 API 스펙 확정되면 프론트 타입·UI 문구를 맞춰 드리겠습니다.
