#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export SESSION_SECRET="${SESSION_SECRET:-eval-e2e-session-secret-32chars-min}"
E2E_DATA_DIR="$(mktemp -d)"
export DATABASE_PATH="${DATABASE_PATH:-$E2E_DATA_DIR/e2e-ledger.sqlite}"
npm run start --workspace @personal-ledger/api &
API_PID=$!
npm run dev --workspace @personal-ledger/web &
WEB_PID=$!
trap 'kill $API_PID $WEB_PID 2>/dev/null || true; rm -rf "$E2E_DATA_DIR"' EXIT
while kill -0 $API_PID 2>/dev/null && kill -0 $WEB_PID 2>/dev/null; do sleep 2; done
wait $API_PID $WEB_PID 2>/dev/null || true
