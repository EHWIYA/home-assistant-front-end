# GitHub Actions · Secrets 설정

레포: **Settings → Secrets and variables → Actions**

Secrets 등록이 끝났다면 `main` push 또는 Actions → **Deploy to NAS** → **Run workflow** 로 배포를 실행합니다.

## Secrets (필수)

| Secret | 값 | 비고 |
|--------|-----|------|
| `NAS_HOST` | `100.88.40.125` | Tailscale IP |
| `NAS_USER` | `iwh` | SSH 사용자 |
| `NAS_DEPLOY_PATH` | `/home/iwh/iot/web/dist` | nginx 정적 루트 |
| `NAS_SSH_KEY` | *(보안 채널)* | ed25519 개인키 전문 (`-----BEGIN` ~ `-----END`). iot-api와 동일 키 가능 |
| `TS_AUTH_KEY` | *(보안 채널)* | Tailscale reusable auth key. deploy 필수 |
| `VITE_API_KEY` | 백엔드 `IOT_API_KEY` 와 **동일** | `X-API-Key` — 빌드 시 번들 포함. **없으면 401** |

> 키 값은 채팅·레포에 넣지 말고 Secret만 등록. 로컬은 `.env`(git 제외)에 `VITE_API_KEY` 설정.

## Variables (선택)

**Settings → Secrets and variables → Actions → Variables**

| Variable | 권장값 | 비고 |
|----------|--------|------|
| `VITE_API_BASE_URL` | `https://iot-api.iwhya.kr` | 미설정 시 워크플로 기본값과 동일 |

## 워크플로 (build → deploy)

| Job | 내용 |
|-----|------|
| **build** | `npm ci` → Vite 빌드 (`VITE_USE_MOCK=false`, API URL 고정) → `dist` artifact |
| **deploy** | Secret 검사 → Tailscale → `.github/scripts/deploy-to-nas.sh` (rsync) → NAS `post-deploy.sh` |

### NAS post-deploy (1회 설치)

레포 `scripts/nas/post-deploy.sh` 를 NAS에 복사합니다.

```bash
install -d /home/iwh/iot/web/bin
cp post-deploy.sh /home/iwh/iot/web/bin/post-deploy.sh
chmod +x /home/iwh/iot/web/bin/post-deploy.sh
```

미설치 시 GHA는 rsync 후 원격 `ls` 만 실행합니다.

트리거: `main` push, 또는 `workflow_dispatch`(수동 실행).

## 동작 요약

1. **build** job은 항상 실행
2. **deploy** job: NAS Secrets 가 모두 있으면 Tailscale → rsync
3. NAS SSH Secret 일부만 없으면 → deploy 는 스킵(성공), build 만 완료
4. NAS Secrets 는 있는데 `TS_AUTH_KEY` 가 없으면 → **deploy 실패**

## 등록 후 확인

1. Secrets 저장
2. `main` 에 push (또는 Actions 탭에서 workflow 재실행)
3. **Connect Tailscale** · **Deploy dist to NAS** 단계 성공 여부 확인
4. Tailscale ON → https://iot.iwhya.kr

## 장애 시

| 증상 | 확인 |
|------|------|
| SSH timeout | `TS_AUTH_KEY` 등록, Tailscale 단계 로그 |
| 403 (브라우저) | Tailscale 또는 집 LAN |
| CORS / API 오류 | Variable·빌드의 API URL이 `https://iot-api.iwhya.kr` 인지 |
