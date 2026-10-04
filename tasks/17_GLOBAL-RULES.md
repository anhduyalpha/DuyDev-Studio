# Global Rules for Every Agent

1. UI already exists. Do not redesign.
2. Inspect before editing.
3. Reuse existing project conventions.
4. Never rewrite the project just to make it cleaner.
5. One TASK per turn.
6. Never silently continue to the next TASK.
7. Do not use `/goal` for the entire module.
8. AI output must be structured and schema-validated.
9. Never feed raw AI output directly to the renderer.
10. Code handles deterministic work.
11. AI handles semantic ambiguity and visual understanding.
12. Do not request chain-of-thought.
13. Do not let AI generate an entire HTML document.
14. Do not call AI once per question unless a specific exception is justified.
15. Use adaptive batching.
16. Prefer code fast-path before vision calls.
17. Use selective visual QA, not full-document vision by default.
18. Final success requires exactly two PDFs:
    - `{prefix}_DeBai.pdf`
    - `{prefix}_DapAn.pdf`
19. Keep source provenance.
20. Do not modify source meaning during normalization.
21. If scan PDF is detectable, try an OCR/vision path before rejecting.
22. If something is outside scope, record it and stop.
