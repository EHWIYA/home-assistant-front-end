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
