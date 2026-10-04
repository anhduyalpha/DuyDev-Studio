# TASK-09 — Style Presets, Layout Engine, Two PDF Compilers

## Goal

Implement the deterministic document compiler.

## Style presets

At least:
`blue_black_classic`

Target characteristics based on the supplied reference:
- A4 portrait;
- blue/black dominant;
- minimal title;
- section banner;
- compact professional worksheet;
- clear question hierarchy.

Style is data/config, not AI output.

Future styles must be addable without modifying question logic.

## Layout engine

AI may provide a hint, but code decides.

Candidate option layouts:
- 4 columns: short options;
- 2 columns: medium options;
- 1 column: long statements/equations.

Use estimated rendered width/height and available page width.

Pagination:
- avoid splitting question;
- avoid orphan section heading;
- balance page density;
- avoid unnecessary final page waste without sacrificing readability.

## Compiler A — Question PDF

Create:
`{prefix}_DeBai.pdf`

Includes:
- title;
- optional subtitle;
- student information if configured;
- sections;
- questions;
- options;
- images/tables/formulas;
- footer page count.

## Compiler B — Answer PDF

Create:
`{prefix}_DapAn.pdf`

Includes:
1. quick answer matrix;
2. detailed solutions;
3. supporting equations/images where required.

## Requirements

- template-based HTML/CSS;
- no arbitrary AI-generated HTML document;
- A4 portrait;
- page numbers;
- print-safe fonts;
- output path isolated per job.

## Acceptance

Given the same IR + same style:
- deterministic output;
- both PDFs produced;
- both open;
- A4 dimensions;
- no clipping/overflow.
