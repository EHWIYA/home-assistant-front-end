# 운영 승격 비활성·격리 리허설

`frontend_publish.py publish`는 인자/환경과 관계없이 항상 거부한다. 운영 승인 flag·SSH 키·gateway나 자동화 활성화를 추가하지 않는다. 기존 `/home/iwh/apps/iot/web/dist`와 apps 하위는 리허설 root가 될 수 없다.

리허설 root는 `/home/iwh/reports`의 별도 하위 디렉터리이고, 일반 파일 `.front-rehearsal-root`에 `{"scope":"front-publish-rehearsal-v1","production":false}`가 있어야 한다. root·부모·live/candidate/previous의 symlink/mount/소유자/장치를 확인한다. 부모가 운영 tree의 사본을 이 root/live에 준비한 뒤 실제 운영은 더 이상 쓰기 대상으로 사용하지 않는다.

- `audit_archive`는 raw tar/receipt를 제한 검증하고 선택적으로 부모가 공식 GitHub API에서 받은 artifact metadata·원본 ZIP의 digest와 내부 바이트를 대조한다. GitHub run/job 성공·최신 main·입력 HMAC/profile 유효성·운영 승인 자체를 이 모듈의 bool 입력으로 대체하지 않는다. 이를 확인하는 상위 호출자와 결과를 분리하며 서명 attestation·운영 적격으로 보고하지 않는다.
- `prepare`는 새 candidate와 이전 tree의 복구 사본을 만들고 immutable 자산을 양방향 합친다. 같은 URL의 다른 내용은 index/version/manifest/SW/Firebase worker 등 명시한 mutable 진입 파일만 허용한다. 그 외 충돌은 중단한다. 원본 사본 live의 manifest CAS와 전체 tree SHA를 확인한다.
- 준비 도중 실패하면 partial candidate/previous를 자동 삭제하지 않는다. 원장이 완성되지 않은 root를 재사용하지 않고 실패 근거를 보존한 채 새로운 격리 root를 준비한다. 운영 승격용 crash-consistency/권한 경계가 구현됐다고 보고하지 않는다.
- `activate`/`rollback`은 같은 장치에서만 renameat2(RENAME_EXCHANGE)를 사용하고 지원 실패 시 비원자적 fallback을 하지 않는다. 교체 전 pending 원장과 교체 후 상태를 각각 fsync한다. 중단 시 `recover`는 두 tree의 실제 SHA로 교체 전/후를 구분하며, 모호하면 추측하지 않고 중단한다. 실패 원장을 삭제하거나 TTL로 해제하지 않는다.
- activate의 첫 교환 및 중복 성공 응답은 previous의 실제 SHA가 준비 때 저장한 rollback_sha와 같은 경우에만 가능하다. 복구 사본이 사라지거나 변조되면 교환을 거부한다. 원장 쓰기는 고유 O_EXCL 임시 파일을 쓰므로 replace 전 crash에서 남은 실패 파일이 다음 recover 쓰기를 막지 않으며, 잔여 파일은 보존한다.
- CLI의 리허설 쓰기는 기존 maintenance.blocked/locked를 그대로 사용한다. 단위 테스트만 임시 표식/가짜 boundary를 주입한다. 일반 사용자/별도 작성자가 이 잠금을 우회하지 않는다는 보증이나 mount 강제 변경 방지는 아니다.
- CLI audit/rehearse는 모두 HDD managed 후보만 읽는다. 기존 hdd_backup.Storage를 lazy import해 UUID/mount 검증과 읽기 전체 HDD FD 수명을 유지하며, dirfd/O_NOFOLLOW·소유자·동일 장치·일반 파일을 확인한 뒤 archive16MiB/receipt256KiB 이하만 bounded read한다. tree manifest/복사는 개별8MiB·파일1024개·전체64MiB·항목2048/깊이32 제한과 읽기 중 변경 검사, 복사 전 필요한 공간 및64MiB 여유를 적용한다. /dev/zero·symlink·FIFO·초과 크기는 읽기 전에 거부한다.
- 서버 tree rollback은 브라우저의 이미 열린 탭·SW·푸시 구독을 즉시 복원하지 않는다. 부모가 실제 nginx 복사본·구/신 브라우저·모의 외부 API로 별도 검사하고 그 한계를 보고한다.

부모 실행 예: NAS test guard 아래 `python3 -m unittest discover -s ops -p test_frontend_publish.py -v`. 이 문서/코드 작성자는 직접 실행하지 않았으며 실제 검증 결과는 부모 원장으로 판단한다. 리허설 중 만든 새 임시 fixture만 테스트 cleanup 대상이며 운영 source·로그·기록·복구 자료는 삭제하지 않는다.

GitHub runner에 `/home/iwh/reports`가 없으면 단위 테스트만 별도 임시 reports 상수를 주입한다. CLI의 운영 경계 상수는 환경변수로 바꾸지 않는다. NAS의 실제 ext4/renameat2 검증과 GitHub 합성 root 검증을 별도로 기록한다. audit의 build input profile은 임의 값을 출력하지 않고 존재/직렬화 hash만 반환하며 HMAC 정합성은 부모의 비공개 비교 결과를 따른다.
# 고정 운영 어댑터 (2026-11-17)

`operating_adapter.py`는 기존 리허설과 같은 archive·manifest·원자 교환·원장 알고리즘을
고정 운영 경로에 연결한다. 운영 정책 기본값 `enabled:false`에서는 `publish`와
`rollback`을 inbox 조회·원장 쓰기보다 먼저 거부한다. `readiness`는 경로·정책·marker만,
`audit`는 root 보관 후보·복구 tar·private build provenance·공식 GitHub source CI까지 검사한다.
실제 운영 배포와 재시작은 이번 검증 범위에 포함하지 않는다.

설치 경로 `/usr/local/libexec/iot-web-publisher`는 root 소유이며 그룹/기타 쓰기를 금지한다.
`python3 -I operating_adapter.py execute --request <32자리 소문자 hex>`는 고정
`/var/lib/iot-web-publisher/requests/<id>.json`만 읽고 결과는 `results/<id>.json`에 쓴다.
요청 정확한 필드는 `operation`, `policy_id`, `request_id`이며 경로·환경 override는 없다.
허용 operation은 `readiness`, `audit`, `publish`, `rollback`, `recover`다.
결과에는 성공 여부·동작·단계·검증 여부만 포함하고 입력 원문·예외 메시지는 복제하지 않는다.

운영 policy는 `/etc/iot-web-publisher/policy.json` root:전용그룹 `0640`이며 정확한 필드는
`schema:1`, `enabled`, `target`, `policy_id`(hex32), `approved_until`, `source_revision`,
`ci_run`(정수), `ci_attempt`(정수), `current_main`, `archive_sha256`, `receipt_sha256`,
`backup_sha256`, `baseline_sha`, `input_profile_digest`다. target은 기존 dist 고정 경로이며
비활성일 때 만료는 null, 활성일 때 UTC 만료 잔여 시간은 0초 초과 900초 이하다.
정책과 inbox 파일은 root 소유, 일반 파일, mode `0600`/`0640`, symlink 없는 부모만 허용한다.
inode·크기·mtime 및 digest를 재검사한다.
운영 inbox 감사는 `/mnt/HDD500GB`가 실제 mount인지와 고정 UUID
`da1072f7-6685-4ad3-b0df-ab6892bc77ac` block device가 mount·inbox의 장치와 같은지
검사한다. 명시적 fixture만 이 물리 HDD 검사를 생략한다.

inbox 고정 파일은 `candidate.tar`, `receipt.json`, `backup.tar`, `provenance.json`이다.
provenance 정확한 필드는 `schema:1`, `archive_sha256`, `source_revision`,
`build_mode:"private-local-build"`, `input_profile_digest`다. 이것은 root가 검증하여 배치한
로컬 private build 기록이며 GitHub source CI를 private build 서명으로 간주하지 않는다.
backup tar는 dist 상대 일반 파일과 안전한 디렉터리만 허용하며 링크/특수 파일은 거부한다.
정규화한 입력을 사용하는 경우 원래 HDD 백업 tar는 별도로 보존한다.

GitHub 검사는 토큰 없는 고정 HTTPS API를 사용한다. 저장소 id `1243065308`, main 최신 head,
`.github/workflows/deploy.yml`, run/attempt/source, 완료 성공과 필수 job
`OIDC and NAS transport verification`, `build-stage-artifact`, `verify-input-profile`,
`stage-only`를 확인한다. 네트워크 조회는 lock 바깥에서 한다. lock 안에서는 동일 policy
digest·입력·기준 live·최대 10초 된 공식 조회의 freshness를 재확인한다.
외부 GitHub head가 이 짧은 사이 다시 바뀌는 경쟁 조건 자체를 전역 원자화할 수는 없다.

공통 IoT lock 대기는 최대 3초, 획득 후 준비·교환·원장 기록은 최대 15초,
CLI 전체는 30초다. systemd의 별도 40초 제한도 함께 적용한다.
기존 정비 marker 두 곳의 존재나 조회 오류는 실행을 막는다. 종료 시 lock은 해제하며
pending 원장을 보존한다. recover는 root policy slot과 원장·양쪽 tree hash가 맞을 때
phase 메타데이터만 확정하며 live를 교환하지 않는다. 모호하면 원본을 보존하고 거부한다.

prepare 도중 제한 시간/오류로 candidate 또는 previous만 남고 state가 없는 경우에는
자동 삭제·덮어쓰기·재시도가 불가능하다. 이 상태는 보호된 실패 증거다. root 운영자가
live manifest와 HDD 원본을 대조하고 별도 승인 후 orphan을 이름이 겹치지 않는 HDD
quarantine에 보존한 뒤 새로운 정책 slot을 준비해야 한다. 기존 원장도 자동 초기화하지
않으므로 후속 release는 별도 승인된 root 보관/새 slot 절차가 필요하다.

격리 CLI의 `--fixture <hex32>`는 `/var/lib/iot-web-publisher/rehearsal/<hex32>`만 선택한다.
그 안의 root policy에 `scope:"rehearsal"`, `production:false`를 추가하고 target도 그 안의
`web/dist`여야 한다. 기존 live의 iwh 소유자와 새 role 소유 candidate를 명시적으로 허용하되,
일반 core `Context`와 owner 기본값은 기존 현재 UID 제한을 유지한다.
`test_operating_adapter.py`는 같은 OperatingLayout/execute로 비활성 거부, 권한/slot/만료,
CI·해시·복구 사본, lock·시간 제한, 중단 원장 복구, 양방향 자산·rollback을 검증한다.
NAS에서는 공통 test guard로 실행하고, 실제 같은 systemd role 격리 실행 결과와 단위 검증을
구분해 기록한다. 아직 실제 사용 효과나 운영 승격 성공으로 보고하지 않는다.

전용 SSH 키는 기존 보관 키와 별개이며 `iot-web-publish readiness|audit|publish|rollback|recover`
고정 명령만 받는다. root 소유 SSH 진입점이 인자 없는 sudo dispatcher로 넘기며,
root가 요청 ID·정책 ID·unit 이름을 만든다. caller의 경로·unit·환경 override는 받지 않는다.
전용 계정은 Docker·iwh 보조 그룹에 속하지 않는다. 서비스는 보호할 web sibling을
읽기 전용 mount로 묶고, Docker socket·ledger·API·개인 환경·SSH 경로를 숨긴다.
CI의 `publisher_readiness` 수동 입력은 OIDC 접속 뒤 준비 상태 검사만 호출하며 실제 승격
명령을 제공하지 않는다. 운영 정책은 `enabled:false`, `approved_until:null`을 유지한다.

시간 제한은 stdin 3초, 공통 잠금 대기 3초, 잠금 내 작업 15초, adapter 전체 30초,
systemd 시작 40초(종료 5초), SSH 연결 작업 55초다. 종료 신호는 전용 서비스 cgroup에만
적용한다. rollback도 공식 GitHub 최신 main과 성공 CI를 요구하므로 main 진행·GitHub 장애
시 자동 rollback은 거부된다. 실제 승격 전에는 HDD 복구 사본과 root 승인 아래의 수동
복구 절차를 준비하며, 확인 없이 원장을 수정하거나 이 검사를 완화하지 않는다.
