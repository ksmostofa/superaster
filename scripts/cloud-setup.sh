#!/usr/bin/env bash
set -euo pipefail
if [[ "$(node --version)" != "v26.11.1" ]]; then
  echo 'Select Node.js 26.11.1 in the environment, then rerun scripts/cloud-setup.sh.' >&2
  exit 2
fi
ONNXRUNTIME_NODE_INSTALL=skip npm ci --no-audit --no-fund
npm run schemas
npm run build
