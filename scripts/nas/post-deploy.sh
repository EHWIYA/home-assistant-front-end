#!/usr/bin/env bash
# NAS — 정적 배포 후 검증 (GHA rsync 이후 실행)
# 설치: /home/iwh/iot/web/bin/post-deploy.sh · chmod +x
set -euo pipefail

DEPLOY_PATH="${1:-/home/iwh/iot/web/dist}"

if [ ! -f "${DEPLOY_PATH}/index.html" ]; then
  echo "::error::index.html 없음: ${DEPLOY_PATH}" >&2
  exit 1
fi

date -Iseconds > "${DEPLOY_PATH}/.deploy-timestamp"
ls -la "${DEPLOY_PATH}" | head -20
echo "post-deploy OK: ${DEPLOY_PATH}"
