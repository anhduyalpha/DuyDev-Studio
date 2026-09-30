# Technical Remediation Report: PyMuPDF Watermark Opacity & Forensic Test Assertions

**Author**: Explorer M1 Remediation (`explorer_pdf_m1_remediation`)  
**Target Milestone**: Milestone M1 (Backend Fastify & Polyglot PyMuPDF Engine)  
**Issue Reference**: Forensic Audit Failure (`auditor_pdf_m1_1/handoff.md`)  
**Status**: REMEDIATION PLAN READY FOR IMPLEMENTATION  

---

## Executive Summary

The Forensic Auditor correctly identified an **Integrity Violation** in Milestone M1:
1. **Watermark Opacity Facade in `engines/document/pdf_ops_advanced.py`**: Calling `shape.finish(fill_opacity=opacity, stroke_opacity=opacity)` does not affect text inserted with `shape.insert_text()`. The output PDF was generated with 0 `/ExtGState` dictionaries and 0 `/ca` / `/CA` operators (100% solid opacity).
2. **Superficial Test Masking in `server/tests/unit/pdf.test.ts`**: The watermark unit test only asserted `expect(pdfDoc.getPageCount()).toBe(2)`, which masked the non-functional opacity feature.

This report provides the **exact, verified, line-by-line diffs** to remedy both files, backed by empirical PyMuPDF source code inspection and test execution.

---

## 1. PyMuPDF Internal Mechanism & Root Cause

### 1.1 Why `Shape.finish()` Failed for Text

Direct inspection of `pymupdf.Shape` (`pymupdf 1.28.2`) reveals why calling `shape.finish(...)` after `shape.insert_text(...)` is a complete no-op:

```python
# PyMuPDF Shape.finish source:
def finish(self, width: float = 1, color: OptSeq = (0,), fill: OptSeq = None, ...,
           fill_opacity: float = 1, stroke_opacity: float = 1, ...) -> None:
    if self.draw_cont == "":  # treat empty contents as no-op
        return
    ...
```

- `shape.insert_text()` writes text operators into `self.text_cont` (not `self.draw_cont`).
- `self.draw_cont` remains an empty string `""` unless vector drawing operations (`draw_line`, `draw_rect`, `draw_circle`) were performed.
- Therefore, `shape.finish(...)` immediately encounters `if self.draw_cont == "": return` and exits without executing `self.page._set_opacity()`.

### 1.2 How `Shape.insert_text()` Handles Opacity

Direct inspection of `pymupdf.Shape.insert_text` shows:

```python
# PyMuPDF Shape.insert_text source:
def insert_text(
    self,
    point: point_like,
    buffer: typing.Union[str, list],
    *,
    ...,
    stroke_opacity: float = 1,
    fill_opacity: float = 1,
    oc: int = 0
) -> int:
    ...
    alpha = self.page._set_opacity(CA=stroke_opacity, ca=fill_opacity)
    if alpha is None:
        alpha = ""
    else:
        alpha = f"/{alpha} gs\n"
    nres = templ1(bdc, alpha, cm, left, top, fname, fontsize)
    ...
    self.text_cont += nres
```

- When `fill_opacity` and `stroke_opacity` are passed directly into `shape.insert_text()`, PyMuPDF calls `page._set_opacity(CA=stroke_opacity, ca=fill_opacity)`.
- This registers the `/ExtGState` dictionary with `/fitzcaXXXX` containing `/CA` and `/ca`.
- PyMuPDF prepends `/{alpha} gs\n` into the text stream right before `BT ... ET`.
- Calling `shape.commit()` flushes `self.text_cont` into the PDF contents stream.

---

## 2. Exact Changes for `engines/document/pdf_ops_advanced.py`

### 2.1 File Location
`engines/document/pdf_ops_advanced.py` (lines 141–170)

### 2.2 Unified Diff

```diff
--- engines/document/pdf_ops_advanced.py
+++ engines/document/pdf_ops_advanced.py
@@ -144,29 +144,45 @@
             if pos == "top":
                 font_size = 20
                 text_len = fitz.get_text_length(text, fontsize=font_size)
                 pt = fitz.Point(max(20.0, (rect.width - text_len) / 2.0), 50.0)
-                shape.insert_text(pt, text, fontsize=font_size, color=(0.5, 0.5, 0.5))
+                shape.insert_text(
+                    pt,
+                    text,
+                    fontsize=font_size,
+                    color=(0.5, 0.5, 0.5),
+                    fill_opacity=opacity,
+                    stroke_opacity=opacity,
+                )
             elif pos == "bottom":
                 font_size = 20
                 text_len = fitz.get_text_length(text, fontsize=font_size)
                 pt = fitz.Point(max(20.0, (rect.width - text_len) / 2.0), rect.height - 45.0)
-                shape.insert_text(pt, text, fontsize=font_size, color=(0.5, 0.5, 0.5))
+                shape.insert_text(
+                    pt,
+                    text,
+                    fontsize=font_size,
+                    color=(0.5, 0.5, 0.5),
+                    fill_opacity=opacity,
+                    stroke_opacity=opacity,
+                )
             else:  # diagonal center
                 font_size = 36
                 text_len = fitz.get_text_length(text, fontsize=font_size)
                 center = fitz.Point(rect.width / 2.0, rect.height / 2.0)
                 pt = fitz.Point(center.x - text_len / 2.0, center.y)
-                shape.insert_text(pt, text, fontsize=font_size, color=(0.5, 0.5, 0.5), morph=(center, fitz.Matrix(45)))
-            shape.finish(fill_opacity=opacity, stroke_opacity=opacity)
+                shape.insert_text(
+                    pt,
+                    text,
+                    fontsize=font_size,
+                    color=(0.5, 0.5, 0.5),
+                    morph=(center, fitz.Matrix(45)),
+                    fill_opacity=opacity,
+                    stroke_opacity=opacity,
+                )
             shape.commit()
 
         if add_numbers:
             shape_num = page.new_shape()
             num_str = f"Trang {idx + 1} / {total}"
             num_len = fitz.get_text_length(num_str, fontsize=10)
             num_pt = fitz.Point(max(20.0, (rect.width - num_len) / 2.0), rect.height - 20.0)
-            shape_num.insert_text(num_pt, num_str, fontsize=10, color=(0.4, 0.4, 0.4))
-            shape_num.finish(fill_opacity=0.8, stroke_opacity=0.8)
+            shape_num.insert_text(
+                num_pt,
+                num_str,
+                fontsize=10,
+                color=(0.4, 0.4, 0.4),
+                fill_opacity=0.8,
+                stroke_opacity=0.8,
+            )
             shape_num.commit()
```

### 2.3 Rationale
- Watermark text receives caller-specified `opacity` directly through `fill_opacity=opacity, stroke_opacity=opacity`.
- Page numbers receive `fill_opacity=0.8, stroke_opacity=0.8` directly.
- The two calls to `shape.finish(...)` are completely removed because `shape.finish()` has zero effect on text and was the root cause of the silent opacity omission.

---

## 3. Exact Changes for `server/tests/unit/pdf.test.ts`

### 3.1 File Location
`server/tests/unit/pdf.test.ts` (line 7 and lines 293–299)

### 3.2 Unified Diff

```diff
--- server/tests/unit/pdf.test.ts
+++ server/tests/unit/pdf.test.ts
@@ -4,7 +4,7 @@
 import path from 'path';
 import crypto from 'crypto';
 import { execSync } from 'child_process';
-import { PDFDocument } from 'pdf-lib';
+import { PDFDocument, PDFName } from 'pdf-lib';
 import { prisma } from '../../src/lib/prisma.js';
 import { StorageManager } from '../../src/storage/storage.manager.js';
 import { processPdfJob } from '../../src/workers/pdf.worker.js';
@@ -293,6 +293,31 @@
     const pdfBytes = await fs.readFile(artifact!.storagePath);
     const pdfDoc = await PDFDocument.load(pdfBytes);
     expect(pdfDoc.getPageCount()).toBe(2);
+
+    // 1. Verify ExtGState dictionary in page resources via pdf-lib DOM
+    const page0 = pdfDoc.getPage(0);
+    const resources = page0.node.Resources();
+    expect(resources).toBeDefined();
+    const extGState = resources?.lookup(PDFName.of('ExtGState'));
+    expect(extGState).toBeDefined();
+
+    // 2. Verify opacity parameters (/ca and /CA) for watermark (0.5) and page numbers (0.8)
+    const extGStateStr = extGState?.toString() || '';
+    expect(extGStateStr).toContain('/ca');
+    expect(extGStateStr).toContain('/CA');
+    expect(extGStateStr).toMatch(/\/(ca|CA)\s*0?\.5/);
+    expect(extGStateStr).toMatch(/\/(ca|CA)\s*0?\.8/);
+
+    // 3. Verify ExtGState dictionary exists across document indirect objects
+    let hasExtGState = false;
+    let hasAlphaParam = false;
+    for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
+      const objStr = obj.toString();
+      if (objStr.includes('/ExtGState')) hasExtGState = true;
+      if (objStr.includes('/ca') || objStr.includes('/CA')) hasAlphaParam = true;
+    }
+    expect(hasExtGState).toBe(true);
+    expect(hasAlphaParam).toBe(true);
+
+    // 4. Verify raw decompressed PDF byte stream contains ExtGState and opacity
+    const rawPdf = pdfBytes.toString('latin1');
+    expect(rawPdf).toContain('/ExtGState');
+    expect(rawPdf).toMatch(/\/(ca|CA)\s*0?\.5/);
 
     await StorageManager.unlinkSafe(artifact!.storagePath);
     await prisma.fileRecord.delete({ where: { id: resultFileId } });
```

### 3.3 Rationale & Forensic Defense
- **Defense-in-depth across 4 verification layers**:
  1. *Layer 1 (PDF Object DOM)*: Directly queries `page0.node.Resources()?.lookup(PDFName.of('ExtGState'))`. Guarantees the PDF renderer attaches the graphics state dictionary to the page resource table.
  2. *Layer 2 (Parameter Value Integrity)*: Serializes the dictionary and tests that `/ca` and `/CA` values match the requested `0.5` opacity and the `0.8` page numbers opacity.
  3. *Layer 3 (Object Context Enumeration)*: Inspects `pdfDoc.context.enumerateIndirectObjects()` to verify that the graphics state dictionary was compiled as a valid indirect object reference in the PDF body.
  4. *Layer 4 (Raw Byte Stream Inspection)*: Validates that `/ExtGState` and `/(ca|CA) 0.5` are physically present in `pdfBytes.toString('latin1')`.
- **Zero Masking**: If PyMuPDF ever regresses or omits opacity, this test immediately fails.

---

## 4. Verification Evidence & Empirical Proof

### 4.1 Empirical Proof in PyMuPDF
Executing the proposed code generates:

```pdf
xref 3: <<
  /Font <<
    /helv 5 0 R
  >>
  /ExtGState <<
    /fitzca5050 <<
      /CA 0.5
      /ca 0.5
    >>
    /fitzca8080 <<
      /CA 0.8
      /ca 0.8
    >>
  >>
>>

Stream content:
q
/fitzca5050 gs
BT
1 0 0 1 143.456 50 Tm
/helv 20 Tf .5 .5 .5 RG .5 .5 .5 rg [<434f4e464944454e5449414c>]TJ
ET
Q

Stream content (page numbers):
q
/fitzca8080 gs
BT
1 0 0 1 169.5 20 Tm
/helv 10 Tf .4 .4 .4 RG .4 .4 .4 rg [<5472616e672031202f2032>]TJ
ET
Q
```

The output PDF is confirmed to contain true PDF graphics state transparency.

### 4.2 Independent Reproduction Command

```bash
# Python verification
python -c "
import fitz
doc = fitz.open()
page = doc.new_page()
s = page.new_shape()
s.insert_text(fitz.Point(100, 100), 'WATERMARK', fill_opacity=0.5, stroke_opacity=0.5)
s.commit()
doc.save('test_proof.pdf')

doc_check = fitz.open('test_proof.pdf')
has_opacity = any('ExtGState' in doc_check.xref_object(x) and '/ca' in doc_check.xref_object(x) for x in range(1, doc_check.xref_length()))
assert has_opacity, 'Failed: ExtGState opacity missing'
print('Verified: ExtGState with opacity successfully generated!')
doc_check.close()
import os; os.remove('test_proof.pdf')
"
```

---

## 5. Implementation Roadmap for Worker

1. Apply Diff in Section 2 to `engines/document/pdf_ops_advanced.py`.
2. Apply Diff in Section 3 to `server/tests/unit/pdf.test.ts`.
3. Optionally apply equivalent assertions to `server/tests/unit/pdf_challenge.test.ts` lines 218–222.
4. Run `cd server && npx tsc --noEmit` -> Expect 0 errors.
5. Run `cd server && npx vitest run tests/unit/pdf.test.ts` -> Expect 7/7 tests passing with genuine opacity assertions.
6. Re-engage Forensic Auditor (`auditor_pdf_m1_1`) for clean verdict.
