# DuyDev Studio - Check Background Server Status (Windows PowerShell)
$ErrorActionPreference = "Continue"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServerDir = Join-Path $ProjectRoot "server"
$PidFile = Join-Path $ServerDir ".server.pid"
$LogFile = Join-Path $ServerDir "server.log"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DuyDev Studio - Server Status         " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$running = $false
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/v1/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($res -and $res.status -eq "UP") {
        $running = $true
    }
} catch {}

if ($running) {
    $pidInfo = if (Test-Path $PidFile) { (Get-Content $PidFile -Raw).Trim() } else { "N/A" }
    $localIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -like "192.168.*" } | Select-Object -ExpandProperty IPAddress -First 1)
    if (-not $localIp) { $localIp = "127.0.0.1" }

    Write-Host "Status:        ONLINE" -ForegroundColor Green
    Write-Host "PID:           $pidInfo" -ForegroundColor Cyan
    Write-Host "Uptime:        $($res.uptimeSeconds) seconds" -ForegroundColor Cyan
    Write-Host "Local URL:     http://localhost:3000" -ForegroundColor Yellow
    Write-Host "Network URL:   http://$($localIp):3000" -ForegroundColor Yellow

    # Check Studocu
    $studocuOnline = $false
    try {
        $sRes = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/v1/studocu/status" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($sRes -and $sRes.data.online) { $studocuOnline = $true }
    } catch {}
    if ($studocuOnline) {
        Write-Host "Studocu:       ONLINE (http://localhost:8090)" -ForegroundColor Green
    } else {
        Write-Host "Studocu:       OFFLINE (Port 8090)" -ForegroundColor DarkGray
    }

    Write-Host "Log file:      $LogFile" -ForegroundColor DarkGray
} else {
    Write-Host "Status:        OFFLINE (Not running on port 3000)" -ForegroundColor Red
    Write-Host "To start:      npm run start:bg" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
