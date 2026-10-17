# Deploy current local changes directly to PRODUCTION environment (Port 3000 / HTTPS)
Write-Host "--> [1/2] Pushing branch 'main' to GitHub..." -ForegroundColor Cyan
git push origin main

Write-Host "--> [2/2] Updating and restarting dd-studio on homeserver..." -ForegroundColor Cyan
ssh anhduy@192.168.2.171 "bash /home/anhduy/dd-studio/scripts/deploy-prod.sh"

Write-Host "--> [3/3] Verifying homeserver health (timeout: 5s)..." -ForegroundColor Cyan
curl.exe --connect-timeout 3 --max-time 5 -s http://192.168.2.171:3000/api/v1/health

Write-Host "`nDone! Production deployed at https://studio.duydev.cloud" -ForegroundColor Green
