## 2026-09-27T16:36:00Z
You are Worker M4: System Verification & Homeserver Deployment Specialist.
Your working directory is: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_v2_m4`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context & Specifications to read first:
1. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md` (header `## 2026-09-27T12:14:56Z`)
2. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\orchestrator_pdf_v2\PROJECT.md`

Objectives:
Execute Milestone M4:
"Triển khai & Kiểm thử Môi trường Thực tế:
- Đồng bộ toàn bộ mã nguồn đã hoàn thiện lên homeserver 192.168.2.171.
- Dịch vụ dd-studio.service khởi động lại trơn tru và phản hồi status: UP tại /api/v1/health.
- Giao diện Web PWA hoạt động trơn tru trên cả desktop và mobile, không có lỗi console rác."

Detailed Execution Steps:
1. Local Syntax, Type & Test Verification:
   - Run `node --check` across all JS files in `src/components/tools/pdf/` and `src/utilities/`.
   - Run `cd server && npx tsc --noEmit` -> Must pass with 0 errors.
   - Run `cd server && npx vitest run` -> Must pass 100% across all suites.
   - Run UI fluff scanner: `python C:\Users\AnhDuy\.gemini\config\skills\ui-annotation-purger\scripts\scan_ui_fluff.py "c:\Users\AnhDuy\Code\Project\DD Studio\src"`.
2. Homeserver Synchronization (`anhduy@192.168.2.171`):
   - Synchronize modified files to `anhduy@192.168.2.171:/home/anhduy/dd-studio/`.
     Key paths to sync:
     - `src/` (especially `src/components/tools/pdf/`, `src/utilities/swipeGesture.js`, `src/utilities/dragReorder.js`)
     - `server/src/` (and `server/tests/`)
     - `engines/`
     (You can use `rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' ...` or `scp` or `tar | ssh`).
3. Homeserver Compilation & Service Respawn:
   - Run remote build on homeserver:
     `ssh anhduy@192.168.2.171 "cd /home/anhduy/dd-studio/server && npm run build"`
   - Restart the daemon:
     `ssh anhduy@192.168.2.171 "systemctl is-active dd-studio.service"`
     If managed by systemd:
     `ssh anhduy@192.168.2.171 "systemctl restart dd-studio.service"` (or `pkill -u anhduy -f 'dist/app.js'` if respawned automatically).
4. Live Health Check Probes:
   - Execute HTTP GET probe on LAN:
     `curl.exe -i http://192.168.2.171:3000/api/v1/health`
   - Execute HTTPS GET probe:
     `curl.exe -k -i https://192.168.2.171:3443/api/v1/health`
   - Both must return HTTP 200 OK `{"status":"UP", ...}`.
5. Capture and record all command outputs in your handoff report:
   `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_v2_m4\handoff.md`.
6. Send a message to parent reporting completion and health verification evidence.
