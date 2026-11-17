# 배포 없는 프런트 산출물 준비

OIDC 태그·audience·호스트 키/권한은 유지한다. main push는 계속 연결 검사만 하고, 수동 workflow_dispatch의 stage_only=true일 때만 별도 빌드·HDD 보관 전송 작업을 실행한다. 운영 배포는 지원하지 않는다. 이 변경은 원본 dirty checkout/운영 dist가 아닌 별도 checkout에서 검증했다.

`deploy-to-nas.sh`의 기본 호출과 `--deploy`는 exit 64로 중단한다. `--prepare-only`는 로컬 산출물 준비, `--stage-only`는 별도 제한 키를 통한 NAS HDD 보관만 수행한다. 아래 run ID는 로컬 합성 식별자이며 실제 GitHub Actions 실행을 뜻하지 않는다.

```bash
GITHUB_SHA="$(git rev-parse HEAD)" GITHUB_RUN_ID=1 \
  bash .github/scripts/deploy-to-nas.sh --prepare-only
```

- 빌드는 먼저 고정 checkout에서 수행한다. NAS에서는 공통 workload 가드와 실행 수명 가드를 사용한다. 공개 API 주소는 `https://iot-api.iwhya.kr`, mock은 false로 빌드한다. 로컬 검사에 운영 `.env`나 API 키를 복사하지 않는다.
- target은 `/home/iwh/apps/iot/web/dist`로 고정하며 다른 경로는 거부한다. 도구가 이 경로에 접근하거나 전송하지는 않는다. checkout `dist`를 읽어 `.ci-artifacts/front-<revision>-<run>/`에만 새 archive/receipt를 쓴다. 소스 dist와 기존 산출물을 덮어쓰지 않는다.
- 숨김/비허용 파일명·민감 이름·symlink·특수 파일, 누락된 HTML/PWA/로컬 HTML 자산, 외부 HTML 자산, 다른 API 주소, 중복 run·bootstrap을 거부한다. CSS/JS 내부 모든 동적 참조나 JS에 이미 삽입된 비밀을 완전 탐지하는 검사는 아니다. 새 빌드의 공개 입력과 산출물 검토를 별도로 유지한다.
- PWA bootstrap은 NAS 기존 post-deploy의 템플릿을 재사용하되 전체 스택 검사를 호출하지 않는다. receipt는 local_isolated/prepared_only이며 GitHub run을 검증한 결과가 아니다. version.json의 prepared_at은 준비 시각, deployed_at은 null이다. 실제 배포 시각·서버 반영 영수증으로 사용하지 않는다.
- archive 멤버별 SHA와 전체 archive SHA를 재읽기 검증한다. receipt의 hash는 현재 준비 산출물에만 해당한다. 미래 실제 배포 시각 처리·추가 후처리는 새 manifest와 재검증이 필요하다.
- NAS에는 독립 `iot_web_ci.py` forced-command gateway와 별도 stage 전용 제한 키를 추가했다. 기존 키/IoT API gateway는 그대로다. `FRONT_STAGE_RELEASE`, `NAS_STAGE_KEY_FILE`, `NAS_SSH_HOST_KEYS`를 지정해 `--stage-only`로 요청한다. host/user/port는 고정이고 SSH config·agent/forwarding을 사용하지 않으며 StrictHostKeyChecking=yes로 고정된 ed25519 키를 확인한다. 일반 SSH 셸·SFTP·SCP·API 명령은 허용하지 않는다.
- gateway는 기존 IoT 정비 표식/배포 표식과 공통 잠금을 재사용한다. 입력/GitHub 조회는 공통 잠금 밖에서 별도 전송 잠금으로 1개만 허용하고 총 45초로 제한한다. 고정 repo/main/workflow/run을 조회 시점에 확인하고 archive/receipt SHA·tar 경로/유형/파일 목록·개별 SHA를 확인한다. HDD Storage 가드/FD 아래 staging/iot-web-ci에만 새로 보관하며 파일을 추출/실행하지 않는다. archive 16MiB, 확장 내용 32MiB/1024파일, 보관 64건/1GiB 상한이며 자동 삭제는 없다.
- 로컬 준비 산출물이 GitHub run에서 생성됐다는 출처 검증은 아니므로 server receipt에도 provenance_verified=false/promotion_allowed=false를 기록한다. 현재 실행 중 run 또는 성공 완료 run만 허용한다. 로컬 SSH 성공은 CI 종단 전송/OIDC 재검증이 아니다. 전용 키는 HDD 비공개로 보관하고 이 저장소의 NAS_STAGE_SSH_KEY secret에만 연결한다. 기존 secret은 유지한다. 빌드 job에는 키나 id-token 권한이 없고, 전송 job의 한 step에서만 키를 받아 임시 0600 파일로 사용 후 그 복사본을 정리한다.
- staging→운영 교체·구 자산 보존·실제 배포 시각·승격 출처 검증은 여전히 활성화하지 않았다. 기존 IoT API forced command를 우회하거나 임의 셸로 풀지 않는다. 검증 없이 rsync/delete/accept-new·실시간 keyscan 신뢰를 복원하지 않는다.
- ledger 운영 교체는 이 경로의 대상이 아니다. 메모리 보존 조건이 해결되기 전 pull/up/restart를 실행하지 않는다.

검사: `.github/scripts/test_*front_release.py`를 unittest로 실행한다. CI run의 결과와 artifact/서버 HDD 해시를 대조해 전송 결과를 판단한다. 브라우저 SW 전환·푸시 알림·운영 배포/rollback은 별도 승인된 검증이 필요하다.
