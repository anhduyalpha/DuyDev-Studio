# Dispatch: Worker M4 - Homeserver Sync & Live Verification

## Mission
Synchronize the completed PDF Studio Pro overhaul to the homeserver `192.168.2.171` and verify live service health:

### Homeserver Environment (Verified by Explorer 3)
- Host: `192.168.2.171`
- User: `anhduy`
- Remote Directory: `/home/anhduy/dd-studio`
- Passwordless SSH: active (`ssh anhduy@192.168.2.171`)
- Service: `dd-studio.service` (runs `/usr/bin/node dist/app.js` in `/home/anhduy/dd-studio/server`)

### Steps to Execute
1. Sync updated files from local to homeserver using `scp`:
   - `engines/document/` -> `/home/anhduy/dd-studio/engines/document/`
   - `server/src/` -> `/home/anhduy/dd-studio/server/src/`
   - `server/tests/` -> `/home/anhduy/dd-studio/server/tests/`
   - `src/components/` -> `/home/anhduy/dd-studio/src/components/`
2. Build on homeserver:
   `ssh anhduy@192.168.2.171 "cd /home/anhduy/dd-studio/server && npm run build"`
3. Restart `dd-studio.service`:
   `ssh anhduy@192.168.2.171 "pkill -u anhduy -f 'dist/app.js'"`
   Wait 5 seconds for systemd auto-restart.
4. Verify service status and health:
   `ssh anhduy@192.168.2.171 "systemctl is-active dd-studio.service"`
   `curl.exe -s http://192.168.2.171:3000/api/v1/health`
   Verify HTTP 200 and `{"status":"UP", ...}`.

Deliver your verification commands and outputs in `handoff.md`, then notify orchestrator.

## 2026-09-24T22:27:37Z
You are Worker M4: Homeserver Deployment & Verification Worker.
Working directory: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_pdf_m4_deploy
Read your detailed mission and commands at: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_pdf_m4_deploy\DISPATCH.md.
Also read homeserver notes from Explorer 3 at: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_testing\report.md.

Task:
1. Sync updated files (`engines/document/`, `server/src/`, `server/tests/`, `src/components/`) to `anhduy@192.168.2.171:/home/anhduy/dd-studio/`.
2. Run build on homeserver: `cd /home/anhduy/dd-studio/server && npm run build`.
3. Restart `dd-studio.service` via `pkill -u anhduy -f 'dist/app.js'`.
4. Verify health endpoint `http://192.168.2.171:3000/api/v1/health` responds UP.

Deliver findings, exact commands, and stdout responses in handoff.md, then notify orchestrator.

## 2026-09-24T22:40:14Z
**Context**: Milestone M4 Homeserver Deployment
**Content**: Great progress on Steps 1–3 (remote build succeeded). Please proceed with Step 4 (restart service via pkill), Step 5 (verify service active and /api/v1/health responds UP), and Step 6 (write handoff.md).
**Action**: Execute remaining steps and deliver handoff report.
