# Dispatch: Worker SSE Fix

## Mission
Fix the SSE connection hang bug in `server/src/api/controllers/jobs.controller.ts`:
- In `getJobEvents`:
  When `job.status === 'COMPLETED'`, after `reply.raw.write(...)`, call `reply.raw.end()`.
  When `job.status === 'FAILED'`, after `reply.raw.write(...)`, call `reply.raw.end()`.
  Ensure `reply.raw.end()` is invoked whenever a terminal SSE event is written.

## Verification
- `cd server && npx tsc --noEmit` -> 0 errors.
- `cd server && npx vitest run` -> 100% pass (118/118 tests).

Write handoff.md and notify orchestrator when done.

## 2026-09-24T22:23:17Z
You are Worker SSE Fix.
Working directory: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_pdf_sse_fix
Read the dispatch instructions at: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_pdf_sse_fix\DISPATCH.md.
Modify `server/src/api/controllers/jobs.controller.ts` so `reply.raw.end()` is invoked after sending completed/failed terminal SSE events.
Run `cd server && npx tsc --noEmit` and `cd server && npx vitest run`.
Write handoff.md and notify orchestrator when done.
