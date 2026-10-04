# TASK-08 — Answer & Solution Engine

## Goal

Generate data for the separate Answer PDF.

## Batch

Use the same adaptive batch principle as extraction.

## Output per question

```json
{
  "question_id": "q17",
  "answer": "D",
  "evidence": "Concise explanation...",
  "confidence": 0.98
}
```

For Part II/III use the appropriate answer representation.

## Rules

- no chain-of-thought;
- concise pedagogical evidence;
- deterministic verification where possible;
- answer must match question options/type;
- flag low-confidence or contradictory result.

## Consistency check

Question IR IDs must map 1:1 to answer records.

## Acceptance

- no missing answers;
- no extra answers;
- answer matrix can be generated from this data;
- detailed solution mapping is stable.
