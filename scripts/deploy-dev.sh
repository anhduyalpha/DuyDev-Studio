#!/usr/bin/env bash
set -e

# ==============================================================================
# DuyDev Studio - Deploy to DEV Environment (Port 3001)
# ==============================================================================

echo "🚀 [DEV DEPLOY] Updating dd-studio-dev from origin/dev..."
cd /home/anhduy/dd-studio-dev
git fetch origin dev
git reset --hard origin/dev

echo "📦 [DEV DEPLOY] Building server..."
cd /home/anhduy/dd-studio-dev/server
npx prisma generate
npx prisma db push --skip-generate
npm run build

echo "🔄 [DEV DEPLOY] Restarting dd-studio-dev.service..."
systemctl --user restart dd-studio-dev.service

echo "🐳 [DEV DEPLOY] Restarting studocu-dl-dev container..."
docker restart studocu-dl-dev

echo "✅ [DEV DEPLOY] Complete! Service status:"
systemctl --user status dd-studio-dev.service --no-pager
