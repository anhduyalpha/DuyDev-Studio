# TASK-14 — Production Hardening

## Goal

Prepare the module for real users.

## Security

- server-side API key;
- safe uploads;
- Drive validation;
- file size limits;
- sanitized filenames;
- isolated temp directories;
- cleanup TTL;
- no untrusted HTML execution in the renderer;
- no arbitrary path from client.

## Reliability

- timeouts;
- bounded retries;
- rate limit handling;
- per-stage error codes;
- job recovery;
- idempotency.

## Performance

- source cache by hash;
- page render cache;
- avoid repeated vision calls;
- adaptive batching;
- parallel independent batches;
- avoid reading full documents into memory when unnecessary.

## Observability

Log:
- job id;
- stage;
- duration;
- batch id;
- AI call count;
- error code.

Do not log secrets.

## Stable errors

Examples:
- `PDF_INVALID`
- `SOURCE_FETCH_FAILED`
- `PDF_UNSUPPORTED`
- `PDF_SCAN_TOO_LOW_QUALITY`
- `AI_TIMEOUT`
- `AI_INVALID_OUTPUT`
- `RENDER_FAILED`
- `QA_FAILED`

## Acceptance

- no temp leak;
- no credential leak;
- predictable failures;
- bounded AI spend per job;
- final files downloadable after worker restart.
