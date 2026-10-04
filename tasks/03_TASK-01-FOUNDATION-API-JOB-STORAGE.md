# TASK-01 — Backend Foundation, Routes, Job State, Storage

## Goal

Create/reuse backend infrastructure for the module without implementing the semantic pipeline.

## Requirements

Adapt to the project's existing stack; do not replace it.

Capabilities:

### Source
Create/reuse:
- source upload endpoint;
- source registration;
- source metadata.

### Job
Create job model/state:
`CREATED`, `RUNNING`, `FAILED`, `COMPLETED`.

It can later be expanded by orchestrator.

### Storage
Per-job isolation:
`jobs/{job_id}/...`

Need:
- source;
- temp;
- artifacts;
- diagnostics.

### Routes

Use project's API conventions. Capability equivalents:

`POST /api/pdf-exercises/sources`
`POST /api/pdf-exercises/jobs`
`GET /api/pdf-exercises/jobs/{job_id}`
`GET /api/pdf-exercises/jobs/{job_id}/files`

### Security
- server-only secrets;
- filename sanitization;
- upload size limits;
- no path traversal.

## Acceptance

- UI can create a job.
- Status can be queried.
- Source can be stored.
- No long-running generation in request thread.
- Existing UI remains visually unchanged.
