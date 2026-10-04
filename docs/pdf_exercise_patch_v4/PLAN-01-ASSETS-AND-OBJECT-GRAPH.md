# PLAN-01 — Fix Rich Assets + Object/Question Association

## Includes

- TASK-01
- TASK-02

## Goal

Stop visual assets from disappearing and preserve the relation between a
question and its image/diagram/table/equation.

## Implementation order

### Phase A — TASK-01

1. Locate current PDF object extraction.
2. Reuse existing PDF library and storage abstractions.
3. Add asset extraction records.
4. Add raster extraction.
5. Add visual-region fallback crops for diagrams/vector content.
6. Add asset hashing/provenance.
7. Add cleanup handling.
8. Add unit tests.

### Phase B — TASK-02

1. Define page object model.
2. Build object graph from existing text blocks + assets.
3. Implement deterministic proximity/containment association.
4. Add cross-page relationship support.
5. Add selective Agnes resolver only for ambiguous relationships.
6. Add IR rich_elements mapping.
7. Add tests.

## Do not

- redesign UI;
- change final PDF visual style;
- rewrite unrelated PDF processing;
- make Agnes render images;
- send every image to Agnes;
- implement pagination fixes (TASK-03).

## Required golden cases

Use the supplied source/output pair as regression references:
- image referenced by Linoleic acid question;
- reaction scheme questions;
- formula/visual blocks around later questions.

The source contains question 41 with a structure figure reference and
question 36/37 reaction schemes. The production output demonstrates that
those visual regions can be lost/flattened.

## Exit criteria

Before proceeding:
- extracted assets are visible to renderer input;
- question → asset relationship is explicit;
- text-only PDF regression passes.
