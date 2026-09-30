#!/usr/bin/env bash
set -e

# ==============================================================================
# DuyDev Studio (DS) - Stop Server Script
# Usage: ./scripts/stop.sh
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

if command -v pm2 >/dev/null 2>&1; then
    pm2 stop dd-studio || true
else
    if [ -f "dd-studio.pid" ]; then
        kill $(cat dd-studio.pid) 2>/dev/null || true
        rm -f dd-studio.pid
    fi
    pkill -f "server/dist/app.js" 2>/dev/null || true
fi

echo "🛑 DuyDev Studio has been stopped."
