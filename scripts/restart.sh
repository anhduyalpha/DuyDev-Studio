#!/usr/bin/env bash
set -e

# ==============================================================================
# DuyDev Studio (DS) - Quick Restart & Update Script
# Usage: 
#   ./scripts/restart.sh         (Just rebuild & restart)
#   ./scripts/restart.sh --pull  (Pull latest git code, rebuild & restart)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

if [ "$1" == "--pull" ] || [ "$1" == "-p" ]; then
    echo "--> [1/3] Pulling latest code from Git..."
    git pull
    echo "--> Updating Node dependencies..."
    cd server
    npm install
    npx prisma db push --skip-generate
    npx prisma generate
    cd ..
fi

echo "--> [2/3] Compiling backend TypeScript..."
cd server
npm run build
cd ..

echo "--> [3/3] Restarting application..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 restart ecosystem.config.cjs
    pm2 status dd-studio
else
    echo "    Restarting background node process..."
    if [ -f "dd-studio.pid" ]; then
        kill $(cat dd-studio.pid) 2>/dev/null || true
        rm -f dd-studio.pid
    fi
    pkill -f "server/dist/app.js" 2>/dev/null || true
    nohup node server/dist/app.js > logs/out.log 2> logs/error.log &
    echo $! > dd-studio.pid
    echo "Restarted (PID: $(cat dd-studio.pid))"
fi

echo "✅ DuyDev Studio successfully restarted at http://localhost:3001"
