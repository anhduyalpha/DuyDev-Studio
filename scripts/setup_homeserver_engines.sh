#!/usr/bin/env bash
set -e

echo "=== Installing Polyglot Engines & Dependencies for DD Studio ==="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 1. Update system packages
echo "--> Updating apt package lists..."
sudo apt-get update -y

# 2. Native media & document engines
echo "--> Installing native CLI engines (ffmpeg, poppler, 7z, libreoffice)..."
sudo apt-get install -y \
  ffmpeg \
  poppler-utils \
  p7zip-full \
  p7zip-rar \
  libreoffice-core \
  libreoffice-writer \
  libreoffice-calc


# 3. Python 3 environment
echo "--> Installing Python 3 environment packages..."
sudo apt-get install -y python3 python3-pip python3-venv

# 4. Create virtual environment for document engine
echo "--> Setting up Python virtual environment in $PROJECT_ROOT/engines/document..."
mkdir -p "$PROJECT_ROOT/engines/document"
cd "$PROJECT_ROOT/engines/document"

if [ ! -d "venv" ]; then
  python3 -m venv venv
fi

./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

echo "=== All Polyglot Engines Successfully Provisioned! ==="
