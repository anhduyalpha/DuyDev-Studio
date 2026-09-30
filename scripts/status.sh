#!/usr/bin/env bash

# ==============================================================================
# DuyDev Studio (DS) - Service Health & Status Check Script
# Usage: ./scripts/status.sh
# ==============================================================================

echo "=========================================================="
echo "  📊 DuyDev Studio Status Check"
echo "=========================================================="

# 1. PM2 status if available
if command -v pm2 >/dev/null 2>&1; then
    pm2 status dd-studio
fi

# 2. Redis status
echo ""
echo "--> Checking Redis Server:"
if command -v redis-cli >/dev/null 2>&1; then
    REDIS_PING=$(redis-cli ping 2>/dev/null || echo "FAIL")
    if [ "$REDIS_PING" == "PONG" ]; then
        echo "    Redis: ONLINE (PONG)"
    else
        echo "    Redis: OFFLINE or UNREACHABLE"
    fi
fi

# 3. HTTP Health endpoint
echo ""
echo "--> Checking HTTP Health Endpoint (http://localhost:3001/health):"
if command -v curl >/dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" == "200" ]; then
        echo "    Backend Health: OK (HTTP 200)"
        curl -s http://localhost:3001/health
        echo ""
    else
        echo "    Backend Health: FAILED (HTTP $HTTP_CODE)"
    fi
fi

echo "=========================================================="
