# Local-First Development & Git Deployment Workflow

## 1. Core Mandate
All development for DuyDev Studio is strictly **local-first**. Code is developed, tested, and verified on the local machine and deployed exclusively through Git to GitHub.

## 2. Strict Prohibitions
1. **NO WinSCP / NO Remote Server Code Editing**:
   - **FORBIDDEN**: Using WinSCP, `scp`, `rsync`, or SSH remote editing to manually copy source files or modify code on the remote server (`192.168.2.171`).
   - **FORBIDDEN**: SSHing into the homeserver to run `nano`, `vim`, or apply direct hotfixes on the server.
2. **All changes must originate from the local repository**:
   - Working Directory: `c:\Users\AnhDuy\Code\Project\DD Studio`

## 3. Local Execution & Testing Procedure
Always test locally using the pre-configured scripts inside `scripts/`:
- **Start Local Server in Background**:
  - PowerShell: `.\scripts\start-background.ps1` (or `npm run start:bg`)
  - Batch: `.\start-background.bat`
- **Check Status**:
  - PowerShell: `.\scripts\status-background.ps1` (or `npm run status:bg`)
  - Health endpoint: `http://127.0.0.1:3000/api/v1/health`
- **Stop Local Server**:
  - PowerShell: `.\scripts\stop-background.ps1` (or `npm run stop:bg`)
  - Batch: `.\stop-background.bat`
- **Code & Test Verification**:
  - Type checking: `npm --prefix server run build` (`npx tsc --noEmit`)
  - Test suite: `npm --prefix server test -- --run`

## 4. Deployment via Git
- Once code is verified locally, record clean Conventional Commits.
- Push directly to GitHub:
  ```powershell
  git push origin main
  ```
- Any deployment to the homeserver or production environments will pull from GitHub or run automated CI/CD. Never bypass Git.
