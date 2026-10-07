# Deploy current local changes directly to PRODUCTION environment (Port 3000 / HTTPS)
Write-Host "--> [1/2] Pushing branch 'main' to GitHub..." -ForegroundColor Cyan
git push origin main

Write-Host "--> [2/2] Updating and restarting dd-studio on homeserver..." -ForegroundColor Cyan
ssh anhduy@192.168.2.171 "bash /home/anhduy/dd-studio/scripts/deploy-prod.sh"

Write-Host "Done! Production deployed at https://studio.duydev.cloud" -ForegroundColor Green
