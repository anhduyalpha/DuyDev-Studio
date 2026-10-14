# Local -> Git -> Remote Workflow

1. **Local (`DD Studio`)**: Edit code locally $\rightarrow$ run typechecks/tests $\rightarrow$ commit (Conventional Commits) $\rightarrow$ `git push origin main`. No background dev server unless requested.
2. **Deploy to HTTPS**: On UI/backend changes, bump cache version (`sw.js`, `pwa.js`, `index.html`), push, and execute:
   `.\scripts\deploy-prod.ps1` (or SSH: `ssh anhduy@192.168.2.171 "bash /home/anhduy/dd-studio/scripts/deploy-prod.sh"`).
3. **Prohibitions**: No WinSCP / manual file copy; no direct editing on remote server via SSH.
