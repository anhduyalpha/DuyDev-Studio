# Deploy current local changes to DEV environment (Port 3001)
Write-Host "--> [1/2] Pushing branch 'dev' to GitHub..." -ForegroundColor Cyan
git push origin dev

Write-Host "--> [2/2] Updating and restarting dd-studio-dev on homeserver..." -ForegroundColor Cyan
ssh anhduy@192.168.2.171 "bash /home/anhduy/dd-studio-dev/scripts/deploy-dev.sh"

Write-Host "Done! Test your dev server at http://192.168.2.171:3001" -ForegroundColor Green
