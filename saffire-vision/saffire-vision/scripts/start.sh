#!/usr/bin/env bash
# Optional bash helper (Git Bash, WSL, macOS, Linux): starts FastAPI (8000, internal) and Next.js (3000).
set -e
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
pip install -q -r backend/requirements.txt
(cd frontend && npm install --no-audit --no-fund --silent && npm run build)
(cd backend && RELOAD=0 BACKEND_HOST=127.0.0.1 python run.py) &
cd frontend && exec npx next start -p "${PORT:-3000}" -H 0.0.0.0
