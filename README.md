# Hwiya IoT Web (PWA)

모바일 퍼스트 PWA — [iot-api](https://iot-api.iwhya.kr)만 호출합니다. Home Assistant REST는 프론트에서 사용하지 않습니다.

## 화면

| 탭 | 경로 | 기능 |
|----|------|------|
| 홈 | `/` | 요약·빠른 제어 (status + strip 요약) |
| 에어컨 | `/ac` | 플러그·환경·에어컨·수면 모드 |
| PC | `/pc` | Tapo PC 콘센트 제어 |
| 멀티탭 | `/strip` | 헤이홈 4구 ON/OFF · `/strip/schedules` 스케줄 CRUD |
| 설정 | `/settings` | API 정보 · GET /health |

`/sleep` 은 `/ac` 로 리다이렉트됩니다.

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

로컬 예시는 백엔드 담당자 공유 `.env` 를 참고하세요. 운영 URL·키는 [docs/github-setup.md](docs/github-setup.md).

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
src/features/     # dashboard, ac(sleep), settings
src/layouts/      # AppShell + 하단 탭
src/hooks/        # useStatus
```

## 아이콘

`public/icons/` — SVG 원본(`icon.svg`)에서 `npm run icons`로 192/512/apple-touch PNG 생성.
