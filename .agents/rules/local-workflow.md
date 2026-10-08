# Development & Deployment Workflow: Local Code -> Git Push -> Remote Server Test

## 1. Core Workflow Mandate
1. **Local Machine (`c:\Users\AnhDuy\Code\Project\DD Studio`)**:
   - Write code, refactor, and fix bugs 100% locally.
   - Run type checks / tests if needed (`npm --prefix server run build`).
   - Create Conventional Commits and push to GitHub (`git push origin main`).
   - Do NOT run local background dev servers or test on local machine unless explicitly asked.
2. **Homeserver (`anhduy@192.168.2.171`)**:
   - The production site is already running live at `https://duydevstudio.alphadaniel.io.vn` (and LAN `http://192.168.2.171:3000`).
   - To test changes: SSH into the homeserver, pull latest code from GitHub, build, and restart the systemd service:
     ```powershell
     ssh anhduy@192.168.2.171 "cd /home/anhduy/dd-studio && git pull origin main && cd server && npm run build && sudo systemctl restart dd-studio.service && systemctl status dd-studio.service --no-pager"
     ```
   - Test features directly on the server / production URL.

## 2. UI Deployment Mandate (User Rule)
- **Always Deploy UI Changes to HTTPS**: Whenever any UI modification or styling change is completed, always build, bump cache version (`sw.js`, `pwa.js`, `index.html`), commit, push to GitHub, and run `.\scripts\deploy-prod.ps1` to deploy immediately to production HTTPS (`https://studio.duydev.cloud`).

## 3. Strict Prohibitions
- **NO WinSCP / NO File Copying**: Do not use WinSCP, `scp`, or `rsync` to manually upload files to the server.
- **NO Editing on Server**: Do not edit files on the remote server via SSH. All changes must be committed and pushed from local Git.
