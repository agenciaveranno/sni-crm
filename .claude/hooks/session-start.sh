#!/bin/bash
set -euo pipefail

# Run only in Claude Code remote (web) environments.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "[session-start] Preparing KotodamaCRM environment..."

# 1. Install npm workspace dependencies (idempotent; relies on container cache).
if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules/.package-lock.json" ]; then
  echo "[session-start] Installing npm dependencies..."
  npm install --no-audit --no-fund
else
  echo "[session-start] npm dependencies up to date."
fi

# 2. Build @kotodama/shared so apps can resolve its types.
if [ ! -f "packages/shared/dist/index.js" ]; then
  echo "[session-start] Building @kotodama/shared..."
  npm run build --workspace=@kotodama/shared
else
  echo "[session-start] @kotodama/shared already built."
fi

# 3. Install Railway CLI if missing (idempotent).
if ! command -v railway >/dev/null 2>&1; then
  echo "[session-start] Installing @railway/cli..."
  npm install -g @railway/cli --no-audit --no-fund
else
  echo "[session-start] Railway CLI already installed: $(railway --version)"
fi

# 4. Validate RAILWAY_TOKEN presence (warn but do not fail).
if [ -z "${RAILWAY_TOKEN:-}" ]; then
  echo "[session-start] WARNING: RAILWAY_TOKEN is not set."
  echo "[session-start]   Generate a token at https://railway.com/account/tokens"
  echo "[session-start]   and add it as RAILWAY_TOKEN in this environment's variables."
else
  echo "[session-start] RAILWAY_TOKEN is set (length: ${#RAILWAY_TOKEN})."
fi

echo "[session-start] Done."
