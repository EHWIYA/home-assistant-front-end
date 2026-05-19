#!/usr/bin/env bash
# GHA runner — rsync dist → NAS, post-deploy는 NAS 스크립트
set -euo pipefail

DEPLOY_PATH="${NAS_DEPLOY_PATH:-/home/iwh/iot/web/dist}"
POST_DEPLOY="${NAS_POST_DEPLOY_SCRIPT:-/home/iwh/iot/web/bin/post-deploy.sh}"
DIST_DIR="${DIST_DIR:-dist}"

SSH_KEY="${HOME}/.ssh/deploy_key"
SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new)
RSYNC_SSH="ssh ${SSH_OPTS[*]}"

install -m 700 -d "${HOME}/.ssh"
printf '%s\n' "$NAS_SSH_KEY" > "$SSH_KEY"
chmod 600 "$SSH_KEY"
ssh-keyscan -H "$NAS_HOST" >> "${HOME}/.ssh/known_hosts" 2>/dev/null || true

rsync -avz --delete -e "$RSYNC_SSH" "${DIST_DIR}/" "${NAS_USER}@${NAS_HOST}:${DEPLOY_PATH}/"

# NAS post-deploy (없으면 ls만)
ssh "${SSH_OPTS[@]}" "${NAS_USER}@${NAS_HOST}" \
  "if [ -x '${POST_DEPLOY}' ]; then exec '${POST_DEPLOY}' '${DEPLOY_PATH}'; else ls -la '${DEPLOY_PATH}' | head -20; fi"
