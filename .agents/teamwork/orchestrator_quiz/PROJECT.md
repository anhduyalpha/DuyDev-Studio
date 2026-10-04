# Project: Quiz Pipeline v3.0 Upgrade
# Scope: Full Pipeline Refactoring (WP1 to WP8)

## Architecture
- Polyglot Architecture:
  - Python Engines (`engines/quiz/`):
    - `text_utils.py`: Text cleaning and banner detection utilities (extracted to prevent circular imports).
    - `mcq_parser.py`: Deterministic Vietnamese MCQ regex parser (0 AI).
    - `quiz_pipeline.py`: Main processing orchestrator, KaTeX HTML generators, Chrome headless PDF compiler, parallel micro-batching.
    - `quiz_cache.py`: Multi-tier content-hash cache (Extract cache & AI batch cache).
    - `assets/katex/`: Vendored local KaTeX v0.16.11 (CSS, JS, auto-render, woff2 fonts).
  - Node.js Fastify Backend (`server/`):
    - `server/src/workers/quiz.worker.ts`: BullMQ worker spawning Python CLI, streaming JSON progress.
    - `server/src/services/janitor.service.ts`: Scheduled cron maintenance cleaning expired quiz caches (> 7 days).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Deterministic Pre-parser (WP1) | `mcq_parser.py` & `text_utils.py` regex parser, 11+ unit tests | M1 | Plan §WP1 |
| 2 | Fix Duplicate Questions (WP2 - P0) | Clamp effective_count, drop else raw_text fallback, sequential numbering, SHA1 dedup | M1 | Plan §WP2 |
| 3 | Parallel Micro-Batching (WP3) | Batch size 5, ThreadPoolExecutor 4 workers, emit_progress thread-safe lock, graceful degradation | M2 | Plan §WP3 |
| 4 | Smart Error Handling & API Key Hygiene (WP8) | Salvage truncated JSON, adjusted retry (temp 0.0), remove hardcoded key | M2 | Plan §WP8 |
| 5 | Offline KaTeX Vendor & PDF Printing (WP5 - P0) | Local KaTeX v0.16.11, per-job HTML dir, eliminate race condition, Chrome headless flags | M3 | Plan §WP5 |
| 6 | Sweep-line cluster_rects O(n log n) (WP6) | Union-Find + sweep-line + grid bucketing for >1500 rects, freeze public signature | M4 | Plan §WP6 |
| 7 | Explanation Phase 2 & Overlapped Printing (WP4) | `generate_explanations` separate phase, compile worksheet while generating explanation | M4 | Plan §WP4 |
| 8 | Multi-tier Content-Hash Cache & Janitor (WP7) | `quiz_cache.py` extract & AI caches, `cleanupQuizCache` in `janitor.service.ts` | M5 | Plan §WP7 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Pre-parser & Fix Duplicate (P0) | WP1 & WP2 | none | DONE (text_utils.py, mcq_parser.py, test_mcq_parser.py 19/19 pass, quiz_pipeline.py fix, 25/25 tests pass) |
| 2 | M2: Parallel Batching & Error Handling | WP3 & WP8 | M1 | PLANNED |
| 3 | M3: 100% Offline PDF Printing (P0) | WP5 | none | PLANNED |
| 4 | M4: Vector Optimization & Overlapped Print | WP6 & WP4 | M1, M2, M3 | PLANNED |
| 5 | M5: Multi-tier Cache & Janitor Cleanup | WP7 | M1..M4 | PLANNED |
| 6 | M6: Final Verification & Victory Audit | E2E & DoD | M1..M5 | PLANNED |

## Code Layout
- `engines/quiz/text_utils.py`
- `engines/quiz/mcq_parser.py`
- `engines/quiz/test_mcq_parser.py`
- `engines/quiz/quiz_pipeline.py`
- `engines/quiz/test_quiz_pipeline_v2.py`
- `engines/quiz/assets/katex/`
- `engines/quiz/quiz_cache.py`
- `server/src/services/janitor.service.ts`
