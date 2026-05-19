#!/usr/bin/env bash
# GHA — deploy skip 여부 (GITHUB_OUTPUT)
set -euo pipefail

if [ -z "${NAS_HOST:-}" ] || [ -z "${NAS_USER:-}" ] || [ -z "${NAS_SSH_KEY:-}" ]; then
  echo "skip=true" >> "${GITHUB_OUTPUT}"
  echo "::notice::NAS secrets 미설정 — 배포 job을 건너뜁니다."
  exit 0
fi

if [ -z "${TS_AUTH_KEY:-}" ]; then
  echo "::error::TS_AUTH_KEY Secret이 필요합니다. (hosted runner는 tailnet 밖)"
  exit 1
fi

echo "skip=false" >> "${GITHUB_OUTPUT}"
