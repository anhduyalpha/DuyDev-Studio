# Fast, non-blocking health check with strict 5-second timeout
# Avoids PowerShell 'curl' alias (Invoke-WebRequest) hangs and network stalls
Write-Host "Checking DD Studio homeserver health (timeout: 5s)..." -ForegroundColor Cyan
try {
    $res = curl.exe --connect-timeout 3 --max-time 5 -s http://192.168.2.171:3000/api/v1/health
    if ($res) {
        Write-Host "✅ Health Response: $res" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Warning: Empty response received from homeserver" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error connecting to homeserver: $_" -ForegroundColor Red
}
