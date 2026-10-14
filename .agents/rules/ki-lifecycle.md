---
activation: always
description: Autonomous Knowledge Item (KI) Lifecycle Protocol
---

# Autonomous KI Lifecycle Protocol (Always-On)

1. **Pre-Flight Consultation**: After `codegraph_explore`, scan [docs/knowledge-base/README.md](../../docs/knowledge-base/README.md) and [docs/GOTCHAS.md](../../docs/GOTCHAS.md) for matching KIs (`KI-CON`, `KI-FIX`, `KI-HOWTO`). Obey past constraints.
2. **Post-Flight Autonomous Maintenance**: Update/create KIs upon 4 triggers without prompting:
   - **Trigger A (Bug Fix / Quirk)**: Create/update `KI-FIX-XXX` & update `docs/GOTCHAS.md`.
   - **Trigger B (Architecture / Flow)**: Create/update `KI-CON-XXX`.
   - **Trigger C (Build / Ops / Tooling)**: Create/update `KI-HOWTO-XXX`.
   - **Trigger D (Code Drift)**: Sync existing KI code snippets and paths.
3. **Index Sync**: Update `docs/knowledge-base/README.md` table and run `node scripts/verify-ki-index.mjs`.
4. **Micro-Receipt**: Report in unified receipt: `KI: <KI-ID>` or `KI: none (<reason>)`.
