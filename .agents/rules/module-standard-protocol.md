---
activation: always
description: Universal Tool Module Engineering & Architecture Standard Protocol
---

# Universal Tool Module Engineering Standard Protocol (Always-On)

> Detailed specification: [docs/MODULE_STANDARD.md](../../docs/MODULE_STANDARD.md) · Blueprint: [TemplateWorkspace.js](../../src/components/tools/_template/TemplateWorkspace.js).  
> Verification auditor: `python scripts/audit_module_compliance.py <path_to_tool>`

Whenever creating, modifying, reviewing, or refactoring any tool module in `src/components/tools/**`:

## 1. Zero-Iframe & Pure Native Modularity ([KI-CON-002](../../docs/knowledge-base/KI-CON-002-native-zero-iframe-tool-module-integration.md))
- Never embed tools via `<iframe>`. All modules must be pure native Vanilla ES Modules with zero-build setup.
- Deconstruct workspaces into cohesive subcomponents (<150 lines/file) in `components/` and state in `hooks/`.

## 2. Mandatory Lifecycle & Zero-Leak Teardown
- Workspaces must be classes with `constructor(containerEl)`, `mount()`, and `unmount()`.
- `unmount()` must remove all event listeners (`window`/`document`), cancel `fetch` (`AbortController`), clear timers, close SSE connections, revoke object URLs, and clear `container.innerHTML`.

## 3. Zero-Flicker Collapsible History Dropbox ([KI-CON-006](../../docs/knowledge-base/KI-CON-006-collapsible-dropbox-history-state-preservation.md), [KI-FIX-040](../../docs/knowledge-base/KI-FIX-040-media-history-isolated-container-zero-flicker-toggle.md))
- **IRON LAW**: Never call `this.render()` on history toggle or item updates.
- Wrap history in an isolated container `<div id="mediaHistoryContainer">` (or `<div id="<toolId>HistoryContainer">`).
- Header toggle (`#btnToggleXxxHistory`) MUST use **In-Place DOM Mutation** (toggling `hidden`/`block` directly on body, rotating chevron).
- Provide `renderHistory()` and `attachHistoryListeners()` updating ONLY the isolated history container.

## 4. Dual-Platform Share Target & Auto-Start ([KI-FIX-039](../../docs/knowledge-base/KI-FIX-039-universal-share-target-multi-platform-extensibility.md))
- If the tool accepts shared URLs/files, complete the 6-point registration:
  1. `ShareReceiverActivity.kt` (add `ShareUrlHandler`)
  2. `MainActivity.kt` (`isSpecializedLink` & `autoStartScript`)
  3. `shareTargetHelper.js` (`SharePayloadType` & `classifySharedPayload`)
  4. `smartUrlRouter.js` (`detectSmartRoute` & `routeMap`)
  5. `ShareTargetModal.js` (`TYPE_LABELS`, `TYPE_ICONS`, dispatch cases)
  6. Workspace `mount()` (`consumePendingAutoStart` & `ds:pending-autostart-ready`)

## 5. Universal Clipboard & Input Sanitization ([KI-FIX-006](../../docs/knowledge-base/KI-FIX-006-clipboard-paste-validation-browser-permissions.md), [KI-FIX-029](../../docs/knowledge-base/KI-FIX-029-universal-clipboard-reader-android-bridge.md))
- Always use `readText()` from `src/utilities/clipboard.js` (with automatic AndroidBridge fallback).
- Sanitize URLs by stripping trailing punctuation, quotes, and tracking query params (`fbclid`, `igsh`, `si`, `utm_*`).
- Support Enter key on input and provide auditory feedback via `soundEngine`.

## 6. Background Multitasking & Push Notifications ([KI-CON-003](../../docs/knowledge-base/KI-CON-003-universal-extensible-multitasking-architecture.md), [KI-FIX-030](../../docs/knowledge-base/KI-FIX-030-android-responsive-push-notifications-v2.md))
- Long-running jobs must register with `taskCoordinator.createTask()`.
- Send notifications via `notificationHelper.send()` (auto-delegated to high-priority Android channel `ds_push_channel_v2`).

## 7. Universal File Viewer & Studio Drive Integration ([KI-FIX-024](../../docs/knowledge-base/KI-FIX-024-universal-viewer-security-streaming-resilience.md), [KI-FIX-038](../../docs/knowledge-base/KI-FIX-038-universal-viewer-safe-extension-badge-overflow.md))
- Output media/documents must open in Universal Viewer via `ViewerConnector.preview()`.
- Validate file extensions ($\le 8$ chars regex, prevent decimal numbers). Support RFC 7233 byte-range streaming.
- Provide 1-touch Save to Drive (`storage.updateItemDrivePath`).

## 8. Impeccable Design & Anti-AI Slop ([KI-CON-001](../../docs/knowledge-base/KI-CON-001-ui-production-minimalism.md))
- Strictly consume CSS variables from `stitch-tokens.css` with 100% Light/Dark parity.
- Touch targets $\ge 44\text{px}$, responsive $\ge 360\text{px}$, zero horizontal overflow.
- Clean copywriting in `useToolRegistry.js`: ban marketing buzzwords and parenthetical annotations.
- Scope icon creation: `window.lucide?.createIcons({ root: containerEl })`.

## 9. Polyglot Backend Standards (Fastify & Python)
- Fastify routes: Zod validation + `StorageManager.sanitizeSafePath()`.
- Python engines: Mandatory `from __future__ import annotations` top header ([KI-FIX-021](../../docs/knowledge-base/KI-FIX-021-python-runtime-future-annotations-polyglot-worker.md)) + `argparse` ([KI-FIX-013](../../docs/knowledge-base/KI-FIX-013-polyglot-cli-subcommand-argparse-inheritance.md)).

## 10. Automated Compliance Audit
- Run `python scripts/audit_module_compliance.py <path_to_tool>` to verify zero violations before commit.
