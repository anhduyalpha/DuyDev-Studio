# TASK-03 — PDF Perception Layer

## Goal

Use code to extract page-level information before calling Agnes.

## Per-page data

- width/height;
- raw text;
- text blocks;
- bounding boxes;
- font/object hints if available;
- images;
- render image path;
- text character count;
- image area ratio.

## Classification

`vector`, `mixed`, `scanned`, `unknown`.

Do NOT automatically reject scan.

## Fast question detection

Implement deterministic heuristics for:
- `Câu N`;
- `A.` `B.` `C.` `D.`;
- `PHẦN I/II/III`;
- section headers.

This is only a candidate detector; semantic ambiguity goes to Agnes.

## Page range expansion support

Expose utilities:
- detect first/last candidate question number per page;
- detect continuation candidate;
- get next page.

## Acceptance

For the provided Ester-style source:
- page text can be extracted;
- question candidates are detected;
- text/bbox metadata is available;
- pages can be rendered to image for selective vision calls.
