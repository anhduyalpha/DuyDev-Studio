# DuyDev Studio - Start Background Server Daemon (Windows PowerShell)
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServerDir = Join-Path $ProjectRoot "server"
$PidFile = Join-Path $ServerDir ".server.pid"
$LogFile = Join-Path $ServerDir "server.log"
$ErrFile = Join-Path $ServerDir "server-err.log"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DuyDev Studio - Starting Background   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Clean up old process on port 3000 if running
try {
    $existingConns = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($existingConns) {
        $pids = $existingConns | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $pids) {
            if ($procId -gt 0) {
                Write-Host "-> Stopping existing process on port 3000 (PID $procId)..." -ForegroundColor Yellow
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Milliseconds 800
    }
} catch {}

# Also check PID file
if (Test-Path $PidFile) {
    try {
        $oldPid = [int](Get-Content $PidFile -Raw).Trim()
        if ($oldPid -gt 0) {
            Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
        }
    } catch {}
    Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
}

# 2. Verify or build dist
$distEntry = Join-Path $ServerDir "dist\app.js"
if (-not (Test-Path $distEntry)) {
    Write-Host "-> Building TypeScript backend..." -ForegroundColor Yellow
    Push-Location $ServerDir
    npm run build
    Pop-Location
}

# 3. Start detached background process
Write-Host "-> Launching background daemon..." -ForegroundColor Yellow
$nodeExe = (Get-Command node).Source
$proc = Start-Process -FilePath $nodeExe `
    -ArgumentList "dist/app.js" `
    -WorkingDirectory $ServerDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $LogFile `
    -RedirectStandardError $ErrFile `
    -PassThru

$proc.Id | Out-File -FilePath $PidFile -Encoding ascii -Force
Write-Host "-> Started process with PID: $($proc.Id)" -ForegroundColor Green

# 4. Wait for health check
Write-Host "-> Waiting for server to initialize..." -ForegroundColor Yellow
$healthy = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Milliseconds 600
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/v1/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($res -and $res.status -eq "UP") {
            $healthy = $true
            break
        }
    } catch {}
}

if ($healthy) {
    $localIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -like "192.168.*" } | Select-Object -ExpandProperty IPAddress -First 1)
    if (-not $localIp) { $localIp = "127.0.0.1" }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ DuyDev Studio is RUNNING (Background)" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  🌐 Local URL:   http://localhost:3000" -ForegroundColor Cyan
    Write-Host "  🌐 Network URL: http://$($localIp):3000" -ForegroundColor Cyan
    Write-Host "  ⚡ Studocu:     http://localhost:8090" -ForegroundColor Magenta
    Write-Host "  📄 Output Log:  $LogFile" -ForegroundColor DarkGray
    Write-Host "  🛑 Stop with:   npm run stop:bg" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "❌ Server failed to respond to health check within 10 seconds." -ForegroundColor Red
    if (Test-Path $ErrFile) {
        Write-Host "Recent errors:" -ForegroundColor Red
        Get-Content $ErrFile -Tail 15
    }
}
