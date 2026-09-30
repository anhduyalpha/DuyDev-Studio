#!/usr/bin/env bash
set -e

# ==============================================================================
# DuyDev Studio (DS) - Full Server Deployment & Bootstrap Script
# Usage: ./scripts/deploy.sh
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================================="
echo "  🚀 Starting DuyDev Studio Server Deployment"
echo "  Target Root: $ROOT_DIR"
echo "=========================================================="

# 1. Check and install system packages if on Debian/Ubuntu
if command -v apt-get >/dev/null 2>&1; then
    echo "--> [1/7] Checking and installing system packages (apt)..."
    sudo apt-get update -y
    sudo apt-get install -y \
        redis-server \
        ffmpeg \
        poppler-utils \
        p7zip-full \
        libreoffice-core \
        libreoffice-writer \
        libreoffice-calc \
        python3 \
        python3-pip \
        python3-venv \
        curl
fi

# 2. Ensure Redis service is active
echo "--> [2/7] Checking Redis Server status..."
if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl enable --now redis-server || sudo service redis-server start || true
elif command -v service >/dev/null 2>&1; then
    sudo service redis-server start || true
fi

# 3. Setup server environment variables
echo "--> [3/7] Setting up server environment configuration..."
cd "$ROOT_DIR/server"
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "    Created server/.env from .env.example"
    else
        cat <<EOF > .env
PORT=3001
HOST=0.0.0.0
NODE_ENV=production
DATABASE_URL="file:./dev.db"
REDIS_URL="redis://127.0.0.1:6379"
STORAGE_ROOT="./data/storage"
MAX_UPLOAD_SIZE_MB=50000
AUTH_MODE=none
CORS_ORIGIN=*
EOF
        echo "    Generated default server/.env"
    fi
fi

# 4. Install Node.js dependencies & Build
echo "--> [4/7] Installing Node dependencies and compiling backend..."
npm install
npx prisma db push --skip-generate
npx prisma generate
npm run build

# 5. Setup Python Polyglot Engine Virtual Environment
echo "--> [5/7] Provisioning Python virtual environment for Converters..."
CONVERTER_DIR="$ROOT_DIR/engines/converter/fastapi_app"
if [ -d "$CONVERTER_DIR" ]; then
    cd "$CONVERTER_DIR"
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    ./venv/bin/pip install --upgrade pip --quiet || true
    if [ -f "requirements.txt" ]; then
        ./venv/bin/pip install -r requirements.txt --quiet || true
    fi
    ./venv/bin/pip install pdf2docx PyMuPDF --quiet || true
    echo "    Python engines ready at $CONVERTER_DIR/venv"
fi

# 6. Ensure log and storage directories exist
mkdir -p "$ROOT_DIR/logs"
mkdir -p "$ROOT_DIR/server/data/storage/uploads"
mkdir -p "$ROOT_DIR/server/data/storage/processed"
mkdir -p "$ROOT_DIR/server/data/storage/temp"

# 7. Start application via PM2 or fallback
echo "--> [6/7] Starting application with PM2 process manager..."
cd "$ROOT_DIR"

if command -v pm2 >/dev/null 2>&1; then
    pm2 startOrReload ecosystem.config.cjs
    pm2 save || true
else
    echo "    PM2 not found globally, installing pm2 via npm..."
    sudo npm install -g pm2 || npm install -g pm2 || true
    if command -v pm2 >/dev/null 2>&1; then
        pm2 startOrReload ecosystem.config.cjs
        pm2 save || true
    else
        echo "    Running backend with standard nohup fallback..."
        pkill -f "node dist/app.js" || true
        nohup node server/dist/app.js > logs/out.log 2> logs/error.log &
        echo $! > dd-studio.pid
    fi
fi

echo "--> [7/7] Deployment complete!"
echo "=========================================================="
echo "  ✅ DuyDev Studio is RUNNING!"
echo "  Local URL:   http://localhost:3001"
if command -v hostname >/dev/null 2>&1; then
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    [ -n "$SERVER_IP" ] && echo "  Network URL: http://$SERVER_IP:3001"
fi
echo "  Status check: ./scripts/status.sh  or  pm2 status"
echo "  Logs:        pm2 logs dd-studio   or  tail -f logs/out.log"
echo "=========================================================="
