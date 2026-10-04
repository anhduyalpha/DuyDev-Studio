# Dispatch for Explorer 1 (Milestone 2: WP3 Parallel Micro-Batching Specialist)

- Working Directory: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m2_batching
- Identity: teamwork_preview_explorer
- Role: Parallel Micro-Batching Specialist
- Milestone: Milestone 2 (WP3)
- Authoritative Requirements: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md
- Specification Plan: C:\Users\AnhDuy\Code\Project\DD Studio\docs\QUIZ_PIPELINE_UPGRADE_PLAN.md (see §WP3)
- Project Root: C:\Users\AnhDuy\Code\Project\DD Studio
- Project Scope: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\orchestrator_quiz\PROJECT.md

## Investigation Tasks
Investigate the parallel micro-batching requirements (WP3) in `engines/quiz/quiz_pipeline.py`:
1. `emit_progress` thread-safety:
   - Verify `_EMIT_LOCK = threading.Lock()` around stdout json printing.
2. `ThreadPoolExecutor` Concurrency:
   - Replace sequential threading with `concurrent.futures.ThreadPoolExecutor(max_workers=MAX_PARALLEL)` where `MAX_PARALLEL = int(os.environ.get("QUIZ_AI_CONCURRENCY", "4"))`.
   - Separate single-batch execution into helper `_run_batch(b_idx: int)`.
   - Aggregate results strictly by index `results[0..n]`, NOT by completion order.
3. Graceful Degradation Policy:
   - If a batch fails, fall back to raw parsed blocks from `windows[i]` (using `_guess_answer_from_raw`) rather than aborting the entire job.
   - If ALL batches fail, raise first exception with original Vietnamese error message.
4. Phase 1 Prompt Engineering:
   - Implement `_build_phase1_prompt(blocks, b_start)` sending structured JSON payload.
   - Adjust `system_prompt` accordingly.
5. Design 5 new unit tests for `test_quiz_pipeline_v2.py`:
   - `test_batches_run_in_parallel`
   - `test_result_order_independent_of_completion_order`
   - `test_partial_batch_failure_degrades_gracefully`
   - `test_all_batches_failure_raises`
   - `test_emit_progress_is_thread_safe`
6. Write findings to `analysis.md` and `handoff.md`.


## 2026-10-03T16:50:37Z
[Message] sender=82523155-5971-4e42-a66e-a71df58f4d82 priority=MESSAGE_PRIORITY_HIGH
You are Explorer 1 for Milestone 2 (WP3 Parallel Micro-Batching Specialist).
Your working directory is:
C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m2_batching

Read your instructions in:
C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m2_batching\DISPATCH.md
and the master plan in:
C:\Users\AnhDuy\Code\Project\DD Studio\docs\QUIZ_PIPELINE_UPGRADE_PLAN.md (specifically §WP3)

Investigate ThreadPoolExecutor concurrency, emit_progress thread-safe locking, graceful degradation, and the 5 new unit tests. Write analysis.md and handoff.md, then report to parent via send_message.
