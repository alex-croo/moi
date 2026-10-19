#!/usr/bin/env bash
set -euo pipefail
cd /workspace/moi
export NEXT_TELEMETRY_DISABLED=1
npm ci --cache /workspace/.cache/npm --no-fund
npm run typecheck
npm run build
