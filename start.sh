#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

if [[ "${NODE_ENV:-development}" == test ]]; then
  CORS_ORIGINS="http://127.0.0.1:${FRONTEND_PORT:-}"
  CLAIM_STORAGE_URL=https://storage.runtime.invalid
  CLAIM_STORAGE_TOKEN=runtime-storage-token-acceptance
  CLAIM_OCR_URL=https://ocr.runtime.invalid
  CLAIM_OCR_TOKEN=runtime-ocr-token-acceptance
  CLAIM_ESIGN_URL=https://esign.runtime.invalid
  CLAIM_ESIGN_TOKEN=runtime-esign-token-acceptance
  CLAIM_FILING_URL=https://filing.runtime.invalid
  CLAIM_FILING_TOKEN=runtime-filing-token-acceptance
  CLAIM_TEMPLATE_URL=https://templates.runtime.invalid
  CLAIM_TEMPLATE_TOKEN=runtime-template-token-acceptance
  VITE_API_PROXY_TARGET="http://127.0.0.1:${BACKEND_PORT:-}"
  export CORS_ORIGINS CLAIM_STORAGE_URL CLAIM_STORAGE_TOKEN CLAIM_OCR_URL CLAIM_OCR_TOKEN
  export CLAIM_ESIGN_URL CLAIM_ESIGN_TOKEN CLAIM_FILING_URL CLAIM_FILING_TOKEN CLAIM_TEMPLATE_URL CLAIM_TEMPLATE_TOKEN VITE_API_PROXY_TARGET
elif [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

for port_name in BACKEND_PORT FRONTEND_PORT; do
  value="${!port_name:-}"
  [[ "$value" =~ ^[0-9]+$ ]] && (( value >= 1024 && value <= 65535 )) || { echo "$port_name must be an explicit integer between 1024 and 65535" >&2; exit 1; }
done
[[ "$BACKEND_PORT" != "$FRONTEND_PORT" ]] || { echo "BACKEND_PORT and FRONTEND_PORT must be different" >&2; exit 1; }
PORT="$BACKEND_PORT"
BACKEND_HOST=127.0.0.1
VITE_API_PROXY_TARGET="http://127.0.0.1:$BACKEND_PORT"
export PORT BACKEND_HOST VITE_API_PROXY_TARGET
for assigned_port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  lsof -nP -iTCP:"$assigned_port" -sTCP:LISTEN >/dev/null 2>&1 && { echo "Assigned port $assigned_port is occupied" >&2; exit 1; }
done

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"
: "${CLAIM_STORAGE_URL:?CLAIM_STORAGE_URL is required}"
: "${CLAIM_STORAGE_TOKEN:?CLAIM_STORAGE_TOKEN is required}"
: "${CLAIM_OCR_URL:?CLAIM_OCR_URL is required}"
: "${CLAIM_OCR_TOKEN:?CLAIM_OCR_TOKEN is required}"
: "${CLAIM_ESIGN_URL:?CLAIM_ESIGN_URL is required}"
: "${CLAIM_ESIGN_TOKEN:?CLAIM_ESIGN_TOKEN is required}"
: "${CLAIM_FILING_URL:?CLAIM_FILING_URL is required}"
: "${CLAIM_FILING_TOKEN:?CLAIM_FILING_TOKEN is required}"
: "${CLAIM_TEMPLATE_URL:?CLAIM_TEMPLATE_URL is required}"
: "${CLAIM_TEMPLATE_TOKEN:?CLAIM_TEMPLATE_TOKEN is required}"

if [[ ! -d backend/node_modules ]]; then
  echo "backend dependencies are missing; run: npm --prefix backend ci" >&2
  exit 1
fi
if [[ "${START_FRONTEND:-true}" == "true" && ! -d frontend/node_modules ]]; then
  echo "frontend dependencies are missing; run: npm --prefix frontend ci" >&2
  exit 1
fi

# Startup is intentionally read-only. Operators run `npm --prefix backend run migrate`
# as a separate deployment step after taking a backup.
if [[ "${NODE_ENV:-development}" != test ]]; then npm --prefix backend run migrate:status; fi

backend_pid=''
frontend_pid=''
cleanup() {
  [[ -n "$backend_pid" ]] && kill "$backend_pid" 2>/dev/null || true
  [[ -n "$frontend_pid" ]] && kill "$frontend_pid" 2>/dev/null || true
  wait "$backend_pid" "$frontend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

npm --prefix backend start &
backend_pid=$!

attempt=0
while ! lsof -nP -iTCP:"$BACKEND_PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  kill -0 "$backend_pid" 2>/dev/null || { echo "Backend exited before binding $BACKEND_PORT" >&2; wait "$backend_pid"; exit 1; }
  (( attempt < 120 )) || { echo "Backend did not bind $BACKEND_PORT within 30 seconds" >&2; exit 1; }
  sleep 0.25
  attempt=$((attempt + 1))
done

if [[ "${START_FRONTEND:-true}" == "true" ]]; then
  npm --prefix frontend run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort &
  frontend_pid=$!
fi

wait "$backend_pid"
