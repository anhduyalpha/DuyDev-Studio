# TASK-05 — Smart Recognition + Adaptive Range Resolver

## Goal

Power the existing "Nhận diện thông minh" box.

User examples:
- "Trang 11 từ câu 1 đến 30"
- "Trang 36-38 lấy 25 câu bắt đầu từ câu 1"

## Output

```json
{
  "start_page": 11,
  "end_page": 13,
  "start_question": 1,
  "question_count": 30,
  "question_mode": "auto",
  "confidence": 0.98,
  "warnings": []
}
```

## Processing strategy

1. Parse easy numeric constraints in code.
2. Inspect page candidates in code.
3. Expand page range deterministically.
4. Call Agnes only when:
   - user language is ambiguous;
   - question boundary is ambiguous;
   - page content is inconsistent.
5. Stop when requested question range/count is satisfied.

## Critical example

If page 11 contains Q1–Q10 and user asks Q1–Q30:
- do not call Agnes three times just to count;
- code inspects page 12, page 13, etc.;
- Agnes resolves only ambiguous continuation/boundary.

## UI behavior

Return enough information for existing fields:
- start page;
- end page;
- count;
- start question;
- warning.

User can edit the result before Generate.

## Acceptance

- Supports range and natural language.
- Correctly expands pages.
- Does not overshoot unnecessarily.
- Handles a question split across pages.
- Has hard limits to avoid runaway traversal.
