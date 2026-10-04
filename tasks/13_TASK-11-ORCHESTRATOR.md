# TASK-11 — Pipeline Orchestrator & Job State

## Goal

Connect all stages into a resumable background pipeline.

## State machine

```text
CREATED
FETCHING
INSPECTING
PLANNING
EXTRACTING
RECONSTRUCTING
NORMALIZING
SOLVING
COMPILING
RENDERING
QA
REPAIRING
FINALIZING
COMPLETED
FAILED
```

## Runtime

Generate endpoint should enqueue/start a background job and return job_id quickly.

Do not hold the browser HTTP request open for the full render.

## Progress

Each state exposes:
- progress;
- message;
- timestamp;
- retry count.

## Idempotency

Retrying the same stage must not create duplicate final artifacts.

## Final gate

Only mark COMPLETED when:

```text
DeBai.pdf exists
AND
DapAn.pdf exists
AND
both pass semantic QA
AND
both pass geometry/render QA
```

## Cleanup

After finalization:
- remove transient files;
- preserve final PDFs;
- preserve minimal diagnostics;
- use TTL for abandoned jobs.

## Acceptance

A job can:
- start;
- progress;
- fail clearly;
- retry safely;
- complete with exactly two PDFs.
