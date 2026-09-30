# Test Engineer Skill (Local Copy)
Source: C:\Users\AnhDuy\.gemini\config\skills\test-engineer\SKILL.md

Core Methodology:
1. Inspect & Plan -> Design Cases -> Generate Tests -> Run & Measure -> Self-Anneal (Max 3)
2. 4-Tier Test Suites: Happy Path, Edge Cases, Nullability, Error Boundaries.
3. Strict verification using `npx tsc --noEmit` and `npx vitest run`.
4. As Challenger/Critic: NEVER modify implementation source code. Only write adversarial tests, stress-test assertions, and report findings to Worker/Parent.
