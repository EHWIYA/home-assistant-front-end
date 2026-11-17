#!/usr/bin/env bash
# 준비 또는 제한된 HDD 보관 전송만. 운영 반영은 비활성화한다.
set -euo pipefail
if [[ $# -ne 1 || ( "$1" != "--prepare-only" && "$1" != "--stage-only" ) ]]; then
  echo '운영 배포 비활성화: --prepare-only/--stage-only만 허용합니다.' >&2
  exit 64
fi
SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
if [[ "$1" == "--stage-only" ]]; then
  exec python3 "${SCRIPT_DIR}/stage-front-release.py"
fi
exec python3 "${SCRIPT_DIR}/prepare-front-release.py" \
 --revision "${GITHUB_SHA:?GITHUB_SHA required}" \
 --run-id "${GITHUB_RUN_ID:?GITHUB_RUN_ID required}" \
 --target "${NAS_DEPLOY_PATH:-/home/iwh/apps/iot/web/dist}"
