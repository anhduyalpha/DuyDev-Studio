#!/usr/bin/env bash
set -e

# ==============================================================================
# DuyDev Studio (DS) - Quick Start Script
# Usage: ./scripts/start.sh
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# Ensure Redis is running
if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start redis-server 2>/dev/null || true
elif command -v service >/dev/null 2>&1; then
    sudo service redis-server start 2>/dev/null || true
fi

# Build if dist/app.js doesn't exist
if [ ! -f "server/dist/app.js" ]; then
    echo "--> Compiled binary not found. Building backend..."
    cd server
    npm run build
    cd ..
fi

mkdir -p logs

if command -v pm2 >/dev/null 2>&1; then
    echo "--> Starting DuyDev Studio via PM2..."
    pm2 start ecosystem.config.cjs
    pm2 status dd-studio
else
    echo "--> PM2 not found, starting via Node in background..."
    pkill -f "server/dist/app.js" 2>/dev/null || true
    nohup node server/dist/app.js > logs/out.log 2> logs/error.log &
    echo $! > dd-studio.pid
    echo "Started (PID: $(cat dd-studio.pid))"
fi

echo "✅ Started! Access at: http://localhost:3001"
