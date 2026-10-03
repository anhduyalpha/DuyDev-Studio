#!/usr/bin/env bash
set -e

# ==============================================================================
# DuyDev Studio - Deploy to PRODUCTION Environment (Port 3000 / HTTPS)
# ==============================================================================

echo "🚀 [PROD DEPLOY] Updating dd-studio from origin/main..."
cd /home/anhduy/dd-studio
git fetch origin main
git reset --hard origin/main

echo "📦 [PROD DEPLOY] Building server..."
cd /home/anhduy/dd-studio/server
npx prisma generate
npx prisma db push --skip-generate
npm run build

echo "🔄 [PROD DEPLOY] Restarting dd-studio.service..."
pkill -f 'node dist/app.js' || true
sleep 3

echo "✅ [PROD DEPLOY] Complete! Service status:"
systemctl status dd-studio.service --no-pager
