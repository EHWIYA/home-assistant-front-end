# FCM Web Push — 서버/인프라(NAS) 공조 요청

**발신:** 프론트엔드 팀  
**수신:** NAS / 인프라 / DevOps 담당  
**목적:** FCM Service Worker·nginx·Firebase 설정 점검

---

## 배경

Hwiya IoT PWA(`https://iot.iwhya.kr`)에서 FCM Web Push를 사용합니다.  
프론트 빌드 시 `scripts/generate-fcm-sw.mjs`가 `public/firebase-messaging-sw.js`를 생성하며, Vite PWA Service Worker(`sw-v3.js`)가 Workbox `importScripts`로 이 파일을 포함합니다.

---

## 1. Firebase / FCM 설정 (NAS 전용)

| 항목 | 위치 | 비고 |
|------|------|------|
| Firebase Web 앱 config | GitHub Secrets → GHA 빌드 → 프론트 번들 | `VITE_FIREBASE_*` 6개 + VAPID |
| **FCM 서비스 계정 JSON** | **NAS 로컬만** | GitHub·프론트 repo **금지** |
| VAPID key pair | Firebase Console · Web Push certificates | `VITE_FIREBASE_VAPID_KEY` |

**요청:** NAS에서 FCM 발송 스크립트/서비스가 서비스 계정 JSON 경로·권한을 유지하는지 확인

---

## 2. Service Worker 배포

- 빌드 산출물: `dist/sw-v3.js` + `dist/firebase-messaging-sw.js`(Workbox에 인라인/import)
- `firebase-messaging-sw.js`는 `.gitignore` — **반드시 GHA build job에서 `generate-fcm-sw.mjs` 실행 후 배포**
- Firebase CDN 버전: **12.15.0** (앱 `firebase@12.15.0`과 정렬 완료)

**요청:** NAS rsync 배포 후 `https://iot.iwhya.kr/firebase-messaging-sw.js` 또는 SW 내부 import 정상 여부 확인

---

## 3. nginx / reverse proxy

Push register API는 **프론트 origin**으로 호출됩니다 (IoT REST API와 분리).

| 클라이언트 호출 | upstream |
|----------------|----------|
| `https://iot.iwhya.kr/api/push/register` | NAS push handler |
| `https://iot.iwhya.kr/api/push/unregister` | 동일 |
| (신규) `/api/push/tokens`, `/test`, `/status`, `/history` | 동일 |

**요청:**

1. `/api/push/*` → NAS push API로 프록시 유지
2. `Authorization: Bearer` 헤더 passthrough
3. PWA `Service-Worker-Allowed` / SW scope `/` — 기존 VitePWA 설정과 충돌 없는지

---

## 4. FCM 발송 payload (NAS → Firebase)

알림 클릭·앱 내 저장 시 아래 필드 필요:

```
data.fingerprint  (필수, stable)
data.title, data.body
data.topic        (ac-anomaly | pc-offline | strip | …)
data.url          (선택, 앱 내 path)
data.summary      (JSON string)
data.issue_id, data.status, data.overall, data.checked_at_kst, data.llm_escalate
```

**notification** 블록(title/body)과 **data** 블록을 함께 보내면 백그라운드 OS 알림 + 앱 저장 모두 동작합니다.

---

## 5. 12시간 발송 제한

- UI: "12시간에 한 번까지 발송"
- **enforcement는 NAS/백엔드** — 프론트는 `GET /api/push/status`의 `nextAllowedAt`만 표시
- 테스트 푸시(`POST /api/push/test`)는 제한 예외 여부 백엔드와 합의

---

## 6. GitHub Actions Secrets 체크리스트

배포 실패 방지 — [docs/github-setup.md](./github-setup.md) 참고

- [ ] `VITE_FIREBASE_API_KEY`
- [ ] `VITE_FIREBASE_AUTH_DOMAIN`
- [ ] `VITE_FIREBASE_PROJECT_ID`
- [ ] `VITE_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `VITE_FIREBASE_APP_ID`
- [ ] `VITE_FIREBASE_VAPID_KEY`
- [ ] `VITE_API_KEY`

Firebase env 누락 시 stub SW만 생성되어 **백그라운드 푸시 미동작** (클릭 핸들러만 존재).

---

## 7. 검증 절차 (배포 후)

1. PWA 설치 → 설정 → 알림 ON → NAS register 200
2. NAS에서 테스트 FCM 발송 (또는 `POST /api/push/test` 구현 후)
3. **백그라운드:** OS 알림 → 클릭 → 올바른 화면 (`url` / `topic` / 알림함)
4. **포그라운드:** Toast + 헤더 벨 배지 + 알림함 실시간 갱신
5. iOS 16.4+ PWA: 홈 화면 추가 후 standalone에서만 push

---

## 문의

- SW 생성: `scripts/generate-fcm-sw.mjs`, `scripts/push-sw-logic.js`
- 백엔드 API 스펙: [push-coordination-backend.md](./push-coordination-backend.md)

인프라 변경(도메인·TLS·SW scope) 시 프론트 팀에 사전 공유 부탁드립니다.
