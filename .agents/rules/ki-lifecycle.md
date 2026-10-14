---
activation: always
trigger: always_on
description: Autonomous Two-Stage Knowledge Item (KI) Lifecycle Protocol for DuyDev-Studio
---

# Autonomous Knowledge Item (KI) Lifecycle Protocol

## Objective
Ensure zero-amnesia engineering across **DuyDev-Studio**. You must autonomously consult, apply, and maintain Knowledge Items (`docs/knowledge-base/`) without requiring explicit user prompting.

---

## 1. STAGE 1 — PRE-FLIGHT KI CONSULTATION (Before Writing Code)
1. **Target Identification**: Right after executing **Step 0: `codegraph_explore`** to locate target symbols, files, or routes, scan:
   - [docs/knowledge-base/README.md](../../docs/knowledge-base/README.md) (Master KI Index)
   - [docs/GOTCHAS.md](../../docs/GOTCHAS.md) (Known Traps & Pitfalls)
2. **Domain Matching**: Search for existing KIs covering the target modules or subsystems:
   - **Service Worker / PWA**: `KI-HOWTO-003`, `KI-FIX-007`
   - **DOM Diffing / Fast Updates**: `KI-CON-001`, `KI-FIX-010`, `KI-FIX-016`
   - **Studocu / Cloudflare CDP**: `KI-FIX-001`, `KI-FIX-002`, `KI-FIX-003`, `KI-FIX-004`
   - **Quiz Pipeline & PDF Paged Media**: `KI-CON-004`, `KI-FIX-017`, `KI-FIX-019`, `KI-FIX-020`
   - **Android Bridge**: `KI-FIX-018`
   - **Polyglot Python Worker Runtime**: `KI-FIX-013`, `KI-FIX-021`
   - **Image Diffing & History**: `KI-CON-005`, `KI-CON-006`, `KI-CON-007`
3. **Constraint Adherence**: Treat matching KIs as inviolable engineering constraints so past regressions and fixed race conditions are never reintroduced.

---

## 2. STAGE 2 — POST-FLIGHT AUTONOMOUS KI MAINTENANCE (Before Concluding Task)
Before declaring any task complete, evaluate the changes against the following 4 autonomous triggers. If ANY trigger matches, update or create the required KI immediately without waiting for user instruction:

- **Trigger A (Bug Fix / Workaround)**:
  - You resolved a non-trivial bug, race condition, timing issue, platform quirk, or regression.
  - *Action*: Create `docs/knowledge-base/KI-FIX-XXX-<slug>.md` (or update existing) using the standard schema. Cross-reference or update `docs/GOTCHAS.md` if the bug is a repeatable trap.
- **Trigger B (Architecture / Pattern Change)**:
  - You introduced or changed a core architecture pattern, state flow, API contract, database schema, or UI paradigm.
  - *Action*: Create or update `docs/knowledge-base/KI-CON-XXX-<slug>.md`.
- **Trigger C (Operational / Build / Tooling Setup)**:
  - You altered deployment scripts (`deploy-prod.ps1`, `deploy-prod.sh`), Docker/PM2/Cloudflare tunnel configs, Android build steps, or developer tooling.
  - *Action*: Create or update `docs/knowledge-base/KI-HOWTO-XXX-<slug>.md`.
- **Trigger D (Stale Reference Drift)**:
  - You modified file paths, function signatures, CLI arguments, or runtime behavior documented in an existing KI.
  - *Action*: Immediately edit that existing KI to sync code snippets, paths, and explanations.

### Index Maintenance Rule:
Whenever any KI file is created, updated, or re-scoped:
1. Update [docs/knowledge-base/README.md](../../docs/knowledge-base/README.md) table entry with ID, Title, Type, Domain, Status, and Trigger.
2. Run `node scripts/verify-ki-index.mjs` to ensure 100% index integrity.

---

## 3. STAGE 3 — MANDATORY COMPLETION RECEIPT (Anti-Forgetting Gate)
At the end of **EVERY** coding, refactoring, debugging, or configuration response, you MUST output a dedicated status block in the following exact format:

```text
📌 [KI Lifecycle]: Consulted: [KI-IDs or None] | Action: [Updated KI-XXX / Created KI-YYY / No KI change needed (reason)]
```

Tasks missing this receipt block are considered incomplete.
