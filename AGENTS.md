# Agent guide — Hwiya IoT Web

## Windows · UTF-8 · PowerShell

이 레포는 Windows + PowerShell 5.x에서 개발합니다. 한글 깨짐·`&&` 파싱 오류를 막기 위해 **Shell 도구 사용 시 아래를 항상 따릅니다.**

상세 규칙: [.cursor/rules/windows-shell-utf8.mdc](.cursor/rules/windows-shell-utf8.mdc)

### Shell 도구 체크리스트

1. **첫 명령 또는 깨짐 발견 시** dot-source:
   ```powershell
   . .\.cursor\scripts\ensure-utf8.ps1
   ```
2. **로컬에서 `&&` 사용 금지** — `;` 또는 명령을 나눠 호출.
3. **표준 검증** — UTF-8 후 lint/build:
   ```powershell
   .\.cursor\scripts\dev-test.ps1
   ```
4. **단일 npm/node 명령**:
   ```powershell
   .\.cursor\scripts\agent-exec.ps1 -Command 'npm run build'
   ```
5. **GHA / NAS bash** — `.github/workflows/*.yml` 안에서는 `&&` 허용.

### 3층 인코딩

| 층 | 경로 |
|----|------|
| 전역 | `%USERPROFILE%\.cursor\ensure-utf8.ps1` |
| 레포 | `.cursor/scripts/ensure-utf8.ps1` |
| IDE | Cursor User `terminal.integrated.profiles` → `PowerShell (UTF-8)` + `terminal-utf8-init.ps1` |

### 파일

- 저장 인코딩: UTF-8 (`.vscode/settings.json` 참고)
- `.env`는 git 제외; 변수 목록은 README 「환경 변수」 절

## 스택·배포

- React · Vite · TypeScript — API는 `https://iot-api.iwhya.kr` (프로덕션 빌드 mock OFF)
- 배포: `main` push → [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
- GitHub Secrets: [docs/github-setup.md](docs/github-setup.md)
