---
activation: always
description: Karpathy Coding Simplicity & Premortem Thinking Protocol
---

# Karpathy Coding & Premortem Thinking (Always-On)

1. **3-POINT PREMORTEM BEFORE EDITING**: Mentally evaluate (state in <=2 lines if non-trivial):
   - *State & Edge Cases*: Null/empty inputs, race conditions, concurrent requests, stale cache?
   - *Lifecycle & Orphans*: Orphaned variables, unclosed streams, or mismatched `addEventListener`/`removeEventListener`?
   - *Backward Compatibility*: Will `.meta.json` sidecars, SQLite rows, or API callers break?
2. **SIMPLICITY FIRST (ANTI-BLOAT)**: Write the minimum code that solves the problem. No speculative abstractions, unnecessary wrappers, or over-engineered classes. If 150 lines can be written clearly in 40 lines, write 40.
3. **SURGICAL PRECISION**: Every changed line must trace directly to the user request. Never reformat unrelated code. Clean up ONLY unused variables/imports your changes orphaned.
4. **SURFACE ASSUMPTIONS EARLY**: If a prompt has critical architectural ambiguity or hidden pitfalls, surface the tradeoff concisely before writing extensive code.
