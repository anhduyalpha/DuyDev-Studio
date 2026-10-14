---
activation: always
description: Token-Miser Quota & Context Conservation Protocol
---

# Token-Miser Protocol (Always-On)

## 5 Iron Laws of Quota Conservation
1. **NO FULL-FILE READS (>120 LINES)**: Never read entire files >120 lines. Use `codegraph_explore` first for line numbers, then view ONLY target ranges (`startLine`..`endLine` +/- 20 lines).
2. **NO REDUNDANT RE-READS**: Once read or edited, do not re-read to "double check"—rely on edit receipts and CLI checkers.
3. **RTK-FIRST CLI EXECUTION**: Always prefix CLI commands with `rtk` (or `rtk err`) to compress terminal noise by 60–90%.
4. **BATCH TOOL CALLS**: Run independent tool calls concurrently in single turns.
5. **ZERO CHATTER & NO CODE ECHO**:
   - Between tool calls: At most 1 brief sentence or zero text.
   - Final response: Never echo edited code blocks. Output 2-4 summary bullets + the 1-line micro-receipt.

<!-- RTK-PROTOCOL-START -->
## Mandatory `rtk` (Rust Token Killer) CLI Proxy Protocol
Whenever executing shell/terminal commands, ALWAYS prefix commands with `rtk` to strip ANSI noise, passing test boilerplate, and verbose logs:
- **Git Operations:** Always run `rtk git status`, `rtk git diff`, `rtk git log`, `rtk git add`, `rtk git commit`, `rtk git push`.
- **TypeScript & Node Verification (`server/` & `src/`):**
  - Run `rtk tsc --noEmit` (or `rtk npm --prefix server run build`).
  - Run `rtk vitest run` for backend test suites.
  - Run `rtk err <command>` when you ONLY need errors/warnings from any build or check command (`node --check`, `python -m py_compile`).
- **File & Directory Inspection (if CLI is used):** Use `rtk ls`, `rtk read <file> -l <lines>`, or `rtk grep`.
- **Fallback:** Only run raw un-prefixed commands if `rtk` does not support that binary, piping via `2>&1 | tail -n 25`.
<!-- RTK-PROTOCOL-END -->

## Unified Micro-Receipt
Every response must conclude with:
`✅ [Verify: <cmd->0> | UI: <ok/n-a> | KI: <ID/none>]`
