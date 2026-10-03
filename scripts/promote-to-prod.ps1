# Promote DEV to PRODUCTION: Merge dev -> main, push, and deploy to Port 3000 (HTTPS)
Write-Host "--> [1/4] Switching to main branch..." -ForegroundColor Cyan
git checkout main

Write-Host "--> [2/4] Merging 'dev' into 'main'..." -ForegroundColor Cyan
git merge dev

Write-Host "--> [3/4] Pushing 'main' to GitHub..." -ForegroundColor Cyan
git push origin main

Write-Host "--> [4/4] Deploying to PRODUCTION server (Port 3000 / HTTPS)..." -ForegroundColor Cyan
ssh anhduy@192.168.2.171 "bash /home/anhduy/dd-studio/scripts/deploy-prod.sh"

Write-Host "Returning to 'dev' branch for continued development..." -ForegroundColor Cyan
git checkout dev

Write-Host "Done! Production deployed at https://duydevstudio.alphadaniel.io.vn" -ForegroundColor Green
