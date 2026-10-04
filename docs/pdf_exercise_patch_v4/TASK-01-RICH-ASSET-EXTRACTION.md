# TASK-01 — Rich Asset Extraction

## Context

Module PDF Exercise is already in production and overall quality is good.
This task fixes a production bug: visual assets from the source PDF can
disappear from the generated exercise.

Observed reference cases:
- A question explicitly refers to a structure/figure but the output loses the figure.
- Reaction schemes/diagrams can be flattened into text instead of remaining visual.
- Some source visual objects may be detached from nearby text.

## Objective

Add a reliable rich-asset extraction layer that preserves source visual assets
as first-class objects.

## Scope

Handle at minimum:
- raster images;
- embedded images;
- vector drawing regions when detectable;
- diagrams/reaction schemes;
- tables/visual blocks when extraction as structured table is unsafe.

## Required behavior

For every selected source page:

1. Inspect PDF objects before question extraction.
2. Extract embedded raster images with:
   - source page;
   - object identifier;
   - bounding box;
   - pixel dimensions;
   - local asset path;
   - content hash.
3. Detect visual regions that are not simple embedded raster images.
4. For vector/diagram regions where exact object extraction is unsafe:
   - create a high-resolution page/crop image;
   - preserve crop bbox and page provenance.
5. Never discard an asset merely because text extraction does not reference it.
6. Do not send every image to Agnes automatically.
7. Mark assets as:
   - `raster`;
   - `vector_region`;
   - `table_region`;
   - `diagram_region`;
   - `unknown_visual`.

## Asset record

Preferred shape:

```json
{
  "asset_id": "asset-p2-004",
  "type": "raster|vector_region|table_region|diagram_region|unknown_visual",
  "source_page": 2,
  "bbox": [x0, y0, x1, y1],
  "path": "...",
  "sha256": "...",
  "width": 0,
  "height": 0,
  "extraction_method": "embedded|crop|rendered",
  "confidence": 1.0
}
```

## Important engineering rules

- Prefer original embedded image over screenshot/crop when equivalent.
- Prefer deterministic extraction over AI recreation.
- Do not alter the visual content.
- Preserve aspect ratio.
- Do not upscale unless needed for rendering/vision.
- Store assets under job-scoped storage.
- Clean temporary assets after finalization but retain assets required by final PDFs.
- Never expose filesystem paths to the browser.

## Acceptance criteria

1. A source PDF containing an image referenced by a question preserves that
   image as an asset.
2. Reaction/diagram regions are preserved instead of silently disappearing.
3. Every extracted asset has page + bbox provenance.
4. Asset extraction is testable independently from Agnes.
5. Existing text-only PDFs behave exactly as before.
6. Extraction failures produce a warning/error record instead of silently
   deleting an asset.
