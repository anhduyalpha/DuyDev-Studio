# TASK-02 — Document Object Graph & Question/Asset Association

## Context

The current production module can correctly extract semantic text in many
cases, but some visual objects become detached from their question. This is
especially visible when a question contains a diagram/structure image or a
reaction scheme.

## Objective

Introduce a document object graph so text, visual assets, equations, tables
and question blocks retain spatial/provenance relationships.

## Scope

Build on TASK-01.

Represent page content as objects such as:

- text block;
- image asset;
- vector region;
- table region;
- equation/math object;
- question candidate;
- option candidate;
- section/header.

Each object must carry:
- stable ID;
- page;
- bbox;
- source order;
- type;
- optional parent/related IDs.

## Relationship model

The graph must support relationships such as:

```text
question_41
 ├── stem_block_41
 ├── asset_41_figure
 ├── option_A
 ├── option_B
 ├── option_C
 └── option_D
```

and:

```text
question_36
 ├── stem
 └── reaction_scheme_asset
```

## Association strategy

Use deterministic evidence first:
- same page;
- geometric containment;
- nearest compatible block;
- vertical position;
- question boundary;
- source ordering.

Use Agnes only when deterministic evidence is ambiguous.

When Agnes is used, send only the relevant page/crop + candidate objects,
not the entire document.

Agnes output must be structured and must identify:
- related object IDs;
- relationship type;
- confidence.

## Cross-page support

The graph must support:

```text
question_17
source_pages: [11, 12]
```

with objects distributed across pages.

An object from page N+1 must be attachable to a question that began on page N.

## Required result

Before renderer, every question should have an object list/rich-element list
that explicitly identifies which visual assets belong to it.

Example:

```json
{
  "question_id": "q41",
  "rich_elements": [
    {
      "asset_id": "asset-p2-004",
      "role": "question_figure",
      "position": "after_stem",
      "confidence": 0.99
    }
  ]
}
```

## Acceptance criteria

1. Question text and its visual assets are associated explicitly.
2. Cross-page questions can retain assets from either page.
3. No source asset can silently disappear between perception and IR.
4. Provenance survives into renderer input.
5. Existing text-only questions are unaffected.
6. Ambiguous associations produce warnings and can invoke selective vision.
