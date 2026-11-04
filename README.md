# Hwiya IoT · 모바일 기기 제어 PWA

에어컨·PC 콘센트·멀티탭의 상태 조회와 제어를 한 화면 흐름으로 묶은 모바일 웹입니다.
Home Assistant 기반 기기 제어 기능을 React PWA와 FastAPI API로 연결합니다.

## 주요 기능

- 홈에서 기기 상태를 요약하고 빠르게 제어
- 에어컨과 플러그 상태 조회 및 제어
- PC 콘센트 제어
- 멀티탭 개별 제어와 스케줄 등록·수정·삭제

## 담당한 구현과 문제 해결

프런트엔드의 API 응답 처리, 에어컨 상태 합성, 홈·상세 화면의 상태 표시를 보완했습니다.
아래 사례는 EHWIYA 계정의 변경 이력과 현재 코드에서 확인할 수 있습니다.

### 1. 같은 에어컨이 화면마다 다르게 표시되는 문제

실시간 `/status`와 폴링으로 읽는 `/ac/state`가 서로 다른 값을 줄 때,
홈 요약과 상세 화면에서 가동 상태가 다르게 보이는 문제가 있었습니다.

각 화면에서 따로 판단하던 상태를 `resolveAcStateView()`로 합성했습니다.
운전 설정은 SSE 상태를 우선하고, 상세 응답의 논리적 저전력 상태는 별도로 다룹니다.
값을 단순히 한쪽 응답으로 덮어쓰기보다, 신호의 의미에 따라 우선순위를 정했습니다.

- **반영 내용:** 합성된 상태를 제어 UI와 홈 요약에 연결하고 운전 설정과 가동 표시를 구분
- **근거:** [상태 합성 수정 커밋](https://github.com/EHWIYA/home-assistant-front-end/commit/f860ceb5099870c59f2fbc60b48ac6fd22889638) · [상태 합성 코드](src/utils/acStateView.ts)

### 2. 오래된 전력값을 근거로 ‘꺼짐’을 확정하는 문제

전력값이 낮더라도 오래된 측정값이거나 가동 추정 신뢰도가 낮으면,
이를 실제 전원 꺼짐과 같은 상태로 표시하기 어렵습니다.

`power_stale`과 `ac_running_confidence`를 상태 판단에 반영했습니다.
측정값이 오래됐거나 신뢰도가 `low`이면 ‘꺼짐’ 대신 ‘확인 중’을 표시합니다.
또한 SSE 응답에서 freshness 필드가 빠졌을 때 이전 메타데이터를 병합하도록 구성했습니다.

- **기술적 판단:** 가동 여부와 데이터 신뢰도를 구분하고, 불확실성을 화면에 표현
- **검증 코드:** stale·low 조건, 홈 요약의 ‘확인 중’ 표시, 저전력 논리 상태, SSE 필드 누락에 대한 [단위 테스트](src/utils/acFreshness.test.ts)
- **근거:** [stale·신뢰도 반영 커밋](https://github.com/EHWIYA/home-assistant-front-end/commit/ffe6c14f0a7138fafa3f764e5f80f0ba4cb33eee) · [freshness 판단 코드](src/utils/acFreshness.ts)

## 설계 선택

| 선택 | 코드에 반영한 방식 |
| --- | --- |
| 화면과 기기 연동 분리 | React PWA는 `iot-api`만 호출하고 Home Assistant 연동은 API 경계 뒤에 둠 |
| 화면별 판단 중복 축소 | 상태 합성과 신뢰도 판단을 공통 함수로 분리 |
| 데이터 불확실성 표시 | 낮은 신뢰도를 전원 꺼짐으로 바꾸지 않고 ‘확인 중’으로 표현 |

위 테스트는 상태 판단 함수와 표시 결과를 확인하는 코드입니다.
실기기 전체 동작이나 운영 중 오표시 발생률을 측정한 결과와는 구분합니다.

## 구조와 기술

```text
React PWA → iot-api (FastAPI) → Home Assistant
```

프런트엔드는 `iot-api`만 호출합니다. Home Assistant REST를 직접 호출하지 않도록
화면과 기기 연동의 경계를 분리했습니다.

| 영역 | 기술 |
| --- | --- |
| 화면 | React, TypeScript, Vite, CSS Modules |
| API 데이터 관리 | TanStack Query |
| 모바일 웹 | vite-plugin-pwa |
| 연동 서버 | FastAPI, Home Assistant |

## 코드와 문서

- [화면별 구현](src/features/)
- [API 클라이언트·타입](src/api/)
- [API 계약](docs/api.md)
- [배포 설정 안내](docs/github-setup.md)

운영 화면은 Tailscale 접속이 필요한 환경입니다. 공개 방문자는 코드와 문서로 구조를 확인할 수 있습니다.

<details>
<summary>개발·환경 설정·배포 안내</summary>

## 화면

| 탭 | 경로 | 기능 |
|----|------|------|
| 홈 | `/` | 요약·빠른 제어 (status + strip 요약) |
| 에어컨 | `/ac` | 플러그·환경·에어컨 제어 |
| PC | `/pc` | Tapo PC 콘센트 제어 |
| 멀티탭 | `/strip` | 헤이홈 4구 ON/OFF · `/strip/schedules` 스케줄 CRUD |
| 설정 | `/settings` | API 정보 · GET /health |

## 스택

- React 18+ · Vite · TypeScript
- CSS Modules (Tailwind 미사용)
- TanStack Query
- vite-plugin-pwa

## 로컬 개발

Windows PowerShell에서는 `&&` 대신 아래 스크립트를 권장합니다 (UTF-8 + 한글 출력). 에이전트 규칙은 [AGENTS.md](AGENTS.md) 참고.

```powershell
npm install
# 프로젝트 루트에 .env 생성 (아래 환경 변수 참고, git 제외)
.\.cursor\scripts\agent-exec.ps1 -Command 'npm run dev'
```

검증(lint + build): `.\.cursor\scripts\dev-test.ps1`

### 환경 변수 (`.env` / `.env.local`, git 커밋 금지)

백엔드 `IOT_API_KEY` 와 동일 값을 `VITE_API_KEY` 로 넣습니다 (`X-API-Key` 헤더).

| 변수 | 로컬 | 운영 (NAS·GHA) |
|------|------|----------------|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8002` | `https://iot-api.iwhya.kr` |
| `VITE_API_KEY` | 백엔드 공유 키 | GitHub Secret `VITE_API_KEY` (동일 값) |
| `VITE_USE_MOCK` | `false` (실 API) | GHA에서 `false` 고정 |
| `VITE_FIREBASE_API_KEY` | Firebase Console | FCM Web Push |
| `VITE_FIREBASE_AUTH_DOMAIN` | `hwiya-iot.firebaseapp.com` | FCM |
| `VITE_FIREBASE_PROJECT_ID` | `hwiya-iot` | FCM |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console | FCM |
| `VITE_FIREBASE_APP_ID` | Firebase Console | FCM |
| `VITE_FIREBASE_VAPID_KEY` | Firebase Console · Web Push | FCM `getToken` |
| `VITE_PUSH_*_URL` | (선택) NAS push API override | 기본 `https://iot.iwhya.kr/api/push/...` |

로컬 예시는 백엔드 담당자 공유 `.env` 를 참고하세요. 운영 URL·키는 [docs/github-setup.md](docs/github-setup.md). FCM 서비스 계정 JSON은 GitHub에 넣지 않습니다.

NAS 배포용 SSH·Tailscale 키는 GitHub Secrets만 사용합니다.

## 빌드

```bash
npm run build
npm run preview
```

## 배포 (GitHub Actions → NAS)

`main` push(또는 Actions 수동 실행) 시 **build** → **deploy**(Tailscale + rsync) 두 job으로 NAS `/home/iwh/iot/web/dist` 에 배포합니다. 프로덕션 빌드는 mock 없이 `https://iot-api.iwhya.kr` 를 사용합니다.

**설정 절차:** [docs/github-setup.md](docs/github-setup.md) (Secrets 표·등록 후 확인)

| Secret | 값 (NAS 회신) | 직접 입력 |
|--------|----------------|-----------|
| `NAS_HOST` | `100.88.40.125` | |
| `NAS_USER` | `iwh` | |
| `NAS_DEPLOY_PATH` | `/home/iwh/iot/web/dist` | |
| `NAS_SSH_KEY` | iot-api와 동일 가능 | ✅ |
| `TS_AUTH_KEY` | reusable auth key | ✅ |

| Variable (선택) | 권장값 |
|-----------------|--------|
| `VITE_API_BASE_URL` | `https://iot-api.iwhya.kr` |

NAS SSH 관련 Secret이 없으면 빌드만 하고 배포는 건너뜁니다. `TS_AUTH_KEY` 없이 NAS Secret만 있으면 워크플로는 실패합니다.

배포 후: Tailscale ON → https://iot.iwhya.kr

## API (iot-api)

OpenAPI·에러 형식·`ac_estimated_running` 정의: [docs/api.md](docs/api.md)  
문서: https://iot-api.iwhya.kr/docs · https://iot-api.iwhya.kr/openapi.json

## 디렉터리

```
src/api/          # client, types, errors, mock
src/features/     # dashboard, ac, settings
src/layouts/      # AppShell + 하단 탭
src/hooks/        # useStatus
```

## 아이콘

`public/icons/` — SVG 원본(`icon.svg`)에서 `npm run icons`로 192/512/apple-touch PNG 생성.

</details>


