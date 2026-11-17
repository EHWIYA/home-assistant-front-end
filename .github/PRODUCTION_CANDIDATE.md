# 미배포 운영 후보와 승격 리허설

이 저장소는 공개 저장소다. API 키가 포함된 실제 운영 후보 번들을 GitHub Actions artifact로 업로드하지 않는다. 일반 push는 연결 검사만, 수동 stage_only는 인증 입력 없는 검증 산출물의 HDD 보관만 수행한다. 실제 운영 배포·재시작은 계속 비활성 상태다.

수동 verify_build_inputs는 npm을 실행하지 않는 별도 fresh job에서 기존 VITE 입력7개의 존재와 지문만 확인한다. 256bit `FRONT_CANDIDATE_INPUT_NONCE`를 비공개로 사용하고 결과에는 nonce 원문이나 입력값 대신 SHA tag/HMAC만 기록한다. 운영 키·Firebase 설정을 바꾸거나 새로 발급하는 기능이 아니다. 빌드 job에는 이 비밀값·SSH 키·id-token 권한을 주지 않는다. OIDC와 제한 stage는 기존 경계를 유지한다.

실제 운영 후보는 검증된 정확한 commit에서 NAS의 별도 비공개 HDD 작업 폴더로 소스를 복원해 Node20으로 만든다. 의존성 설치에는 실제 빌드 입력을 제공하지 않고, 입력을 주입하는 build는 네트워크 없는 제한된 컨테이너에서 수행한다. 원본 .env 전체를 복사하거나 로그/커밋하지 않는다. 선택된 입력·산출물은 비공개0600/0700이며 API 인증 GET·현재 Firebase worker 설정·GitHub 지문·생성 bundle/worker를 값 출력 없이 대조한다. 이 후보의 실행 출처는 NAS 로컬 빌드이며 GitHub에서 생성된 artifact라고 주장하지 않는다.

승격 원시 동작과 실패 복구 검사는 `ops/frontend_publish.py`를 사용한다. CLI publish는 항상 거부한다. 실제 배포 권한·전용 운영 SSH key·root 승인 정책 연결은 활성화하지 않는다. marker가 있는 reports 리허설 root에서만 manifest CAS·정비 차단·원자 교환·양방향 자산 보존·rollback/recover를 시험한다. 이 리허설 구현을 운영 승인·공식 artifact 조회·운영 권한 연결이 모두 완성된 publisher로 해석하지 않는다.

후보 검증은 API 기기 제어·실제 알림 발송·ledger 메모리 조회 없이 수행한다. 실제 운영 반영과 자동화 활성화에는 후보 내용/해시·복구본·브라우저/캐시 관찰 결과를 보고하고 별도의 운영 승인을 받아야 한다.
