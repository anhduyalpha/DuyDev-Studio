# DuyDev Studio - Stop Background Server Daemon (Windows PowerShell)
$ErrorActionPreference = "Continue"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServerDir = Join-Path $ProjectRoot "server"
$PidFile = Join-Path $ServerDir ".server.pid"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DuyDev Studio - Stopping Background   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$stopped = $false

# 1. Stop by PID file
if (Test-Path $PidFile) {
    try {
        $pidToStop = [int](Get-Content $PidFile -Raw).Trim()
        if ($pidToStop -gt 0) {
            Write-Host "-> Stopping process PID $pidToStop..." -ForegroundColor Yellow
            Stop-Process -Id $pidToStop -Force -ErrorAction SilentlyContinue
            $stopped = $true
        }
    } catch {}
    Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
}

# 2. Stop any process still listening on port 3000
try {
    $existingConns = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($existingConns) {
        $pids = $existingConns | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $pids) {
            if ($procId -gt 0) {
                Write-Host "-> Stopping listening process on port 3000 (PID $procId)..." -ForegroundColor Yellow
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                $stopped = $true
            }
        }
    }
} catch {}

# 3. Stop any process listening on port 8090 (Studocu Engine)
try {
    $studocuConns = Get-NetTCPConnection -LocalPort 8090 -ErrorAction SilentlyContinue
    if ($studocuConns) {
        $pids = $studocuConns | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $pids) {
            if ($procId -gt 0) {
                Write-Host "-> Stopping Studocu engine process on port 8090 (PID $procId)..." -ForegroundColor Yellow
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                $stopped = $true
            }
        }
    }
} catch {}

Start-Sleep -Milliseconds 500

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ DuyDev Studio Server STOPPED       " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
