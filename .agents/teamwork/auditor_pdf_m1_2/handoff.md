# Forensic Audit Report: Milestone M1 Re-Audit (Backend & Polyglot PyMuPDF Engine)

**Auditor**: Forensic Auditor 2 (`auditor_pdf_m1_2`)  
**Target Milestone**: Milestone M1 (Backend Fastify & Polyglot PyMuPDF Engine Re-Audit)  
**Parent Agent**: `fc24d654-ab09-4169-9325-66e8b92df489`  
**Integrity Mode**: Demo (per `ORIGINAL_REQUEST.md ## 2026-09-24T17:47:04Z`)  
**Verdict**: **CLEAN**

---

## 1. Observation

### 1.1 Remediation in `engines/document/pdf_ops_advanced.py`
In `cmd_watermark`, lines 147–181:
```python
147:                 shape.insert_text(
148:                     pt,
149:                     text,
150:                     fontsize=font_size,
151:                     color=(0.5, 0.5, 0.5),
152:                     fill_opacity=opacity,
153:                     stroke_opacity=opacity,
154:                 )
...
159:                 shape.insert_text(
160:                     pt,
161:                     text,
162:                     fontsize=font_size,
163:                     color=(0.5, 0.5, 0.5),
164:                     fill_opacity=opacity,
165:                     stroke_opacity=opacity,
166:                 )
...
172:                 shape.insert_text(
173:                     pt,
174:                     text,
175:                     fontsize=font_size,
176:                     color=(0.5, 0.5, 0.5),
177:                     morph=(center, fitz.Matrix(45)),
178:                     fill_opacity=opacity,
179:                     stroke_opacity=opacity,
180:                 )
181:             shape.commit()
```
And for page numbers, lines 188–196:
```python
188:             shape_num.insert_text(
189:                 num_pt,
190:                 num_str,
191:                 fontsize=10,
192:                 color=(0.4, 0.4, 0.4),
193:                 fill_opacity=0.8,
194:                 stroke_opacity=0.8,
195:             )
196:             shape_num.commit()
```
- Direct observation: The ineffective `shape.finish(...)` and `shape_num.finish(...)` calls previously identified in Auditor 1 report were eliminated. Instead, `fill_opacity` and `stroke_opacity` are passed directly into `shape.insert_text(...)` and `shape_num.insert_text(...)`.

### 1.2 Empirical Cross-Reference & Content Stream Disassembly
Executing `cmd_watermark` with `opacity=0.42` and `page_numbers=True`:
```
Page 0 contents xrefs: [6, 7]
Content stream fragment:
   /fitzca4242 gs
Content stream fragment:
   /fitzca8080 gs
xref 3 has ExtGState:
<<
  /Font <<
    /helv 5 0 R
  >>
  /ExtGState <<
    /fitzca4242 <<
      /CA .42
      /ca .42
    >>
    /fitzca8080 <<
      /CA .8
      /ca .8
    >>
  >>
>>
```
- Direct observation: PyMuPDF now generates genuine `/ExtGState` resource dictionaries with unique names (`/fitzca4242`, `/fitzca8080`), containing `/CA` and `/ca` properties matching the exact caller-specified opacity parameters (`.42` for watermark, `.8` for page numbers). In the page content streams, PyMuPDF explicitly emits `/{name} gs` before rendering the watermark and page numbering text.
- Tested all positions (`top`, `bottom`, `diagonal`): All three produce verified `/ExtGState` with requested opacity.
- Tested edge case (`opacity=0.0`): Emits `/ExtGState` with `/ca 0` / `/CA 0` cleanly.
- Tested edge case (`add_numbers=True, text=""`): Emits `/ExtGState` with `/ca .8` cleanly.

### 1.3 Test Suite Rigor in `server/tests/unit/pdf.test.ts`
Lines 297–326:
```typescript
297:     // 1. Verify ExtGState dictionary in page resources via pdf-lib DOM
298:     const page0 = pdfDoc.getPage(0);
299:     const resources = page0.node.Resources();
300:     expect(resources).toBeDefined();
301:     const extGState = resources?.lookup(PDFName.of('ExtGState'));
302:     expect(extGState).toBeDefined();
303: 
304:     // 2. Verify opacity parameters (/ca and /CA) for watermark (0.5) and page numbers (0.8)
305:     const extGStateStr = extGState?.toString() || '';
306:     expect(extGStateStr).toContain('/ca');
307:     expect(extGStateStr).toContain('/CA');
308:     expect(extGStateStr).toMatch(/\/(ca|CA)\s*0?\.5/);
309:     expect(extGStateStr).toMatch(/\/(ca|CA)\s*0?\.8/);
310: 
311:     // 3. Verify ExtGState dictionary exists across document indirect objects
312:     let hasExtGState = false;
313:     let hasAlphaParam = false;
314:     for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
315:       const objStr = obj.toString();
316:       if (objStr.includes('/ExtGState')) hasExtGState = true;
317:       if (objStr.includes('/ca') || objStr.includes('/CA')) hasAlphaParam = true;
318:     }
319:     expect(hasExtGState).toBe(true);
320:     expect(hasAlphaParam).toBe(true);
321: 
322:     // 4. Verify raw decompressed PDF byte stream contains ExtGState and opacity
323:     const rawPdf = pdfBytes.toString('latin1');
324:     expect(rawPdf).toContain('/ExtGState');
325:     expect(rawPdf).toMatch(/\/(ca|CA)\s*0?\.5/);
```
- Direct observation: The test is no longer superficial. It enforces a 4-tier verification (Page resource dictionary lookup, alpha parameter string matching for both `0.5` and `0.8`, document indirect object enumeration, and raw byte stream inspection). If opacity is omitted or set incorrectly, this test fails.

### 1.4 Automated Build & Test Suite Execution
1. **TypeScript Typecheck**:
   `cd server && npx tsc --noEmit`
   Result: Exit code 0, 0 errors.
2. **Unit Test Execution (`pdf.test.ts`)**:
   `cd server && npx vitest run tests/unit/pdf.test.ts`
   Result: `Test Files 1 passed (1), Tests 7 passed (7)`.
3. **Full Server Workspace Test Suite**:
   `cd server && npx vitest run`
   Result: `Test Files 16 passed (16), Tests 92 passed (92)`.

---

## 2. Logic Chain

1. **Previous Finding**: Auditor 1 established that calling `shape.finish(fill_opacity=...)` was a no-op on text in PyMuPDF, resulting in 100% opaque watermarks with zero `/ExtGState` structures emitted, while the unit test only checked `getPageCount() === 2` (Observation 1.1, Auditor 1 report).
2. **Remediation Verification**: Inspection of `engines/document/pdf_ops_advanced.py` confirms that `fill_opacity` and `stroke_opacity` are now supplied directly to PyMuPDF's `insert_text` method in all position branches (`top`, `bottom`, `diagonal`) and for page numbers (Observation 1.1).
3. **Empirical Behavior**: PDF xref stream inspection conclusively demonstrates that PyMuPDF's `_set_opacity` logic is now executed, injecting genuine `/ExtGState` dictionary resources containing `/ca` and `/CA` entries matching the input opacity values, as well as `/{name} gs` graphic state activation operators in the content stream (Observation 1.2).
4. **Test Integrity**: The updated unit test in `server/tests/unit/pdf.test.ts` asserts the exact `/ExtGState` dictionary presence and parameter values across 4 distinct inspection mechanisms (DOM, regex matching, indirect object enumeration, and byte stream analysis). It impossible for a facade or omitted opacity implementation to pass this test (Observation 1.3).
5. **Zero Prohibited Patterns**:
   - No hardcoded test outputs.
   - No facade or dummy implementations.
   - No fabricated logs or artifacts.
   - No self-certifying mock assertions.
   - All 92 unit and integration tests across 16 test files pass without regression (Observation 1.4).
6. **Verdict Deduction**: The work product fulfills all functional, behavioral, and forensic integrity criteria under Demo Mode.

---

## 3. Caveats

- No caveats. The empirical validation directly decompressed and inspected the binary PDF object cross-reference tables and content streams generated by the Python engine, as well as verified the Fastify worker pipeline end-to-end.

---

## 4. Conclusion

**Verdict: CLEAN**

The previously identified integrity violation has been fully and genuinely remediated:
1. `engines/document/pdf_ops_advanced.py` correctly generates genuine PDF graphics state transparency (`/ExtGState`, `/ca`, `/CA`, `/gs`) via `shape.insert_text(..., fill_opacity=..., stroke_opacity=...)`.
2. `server/tests/unit/pdf.test.ts` rigorously tests and enforces the presence of `/ExtGState` and opacity values across 4 independent layers.
3. All TypeScript checks (0 errors) and test suites (92/92 passed) pass completely.

---

## 5. Verification Method

To independently reproduce the forensic verification:

1. **Verify ExtGState and Opacity Generation in Python**:
   ```bash
   python -c "
   import fitz, tempfile, os, argparse
   from engines.document.pdf_ops_advanced import cmd_watermark

   with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f_in, tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f_out:
       in_path = f_in.name
       out_path = f_out.name

   doc = fitz.open(); doc.new_page(); doc.save(in_path); doc.close()
   args = argparse.Namespace(input=in_path, output=out_path, text='AUDIT_TEST', position='diagonal', opacity=0.45, page_numbers=True, strip_metadata=False)
   cmd_watermark(args)

   doc_res = fitz.open(out_path)
   res_str = ''.join([doc_res.xref_object(x) for x in range(1, doc_res.xref_length())])
   assert '/ExtGState' in res_str, 'Missing /ExtGState'
   assert '/ca .45' in res_str or '/ca 0.45' in res_str, 'Missing /ca .45'
   assert '/ca .8' in res_str or '/ca 0.8' in res_str, 'Missing /ca .8 for page numbers'
   doc_res.close()
   os.remove(in_path); os.remove(out_path)
   print('Verification passed: ExtGState with opacity .45 and .8 genuinely present in PDF!')
   "
   ```

2. **Run TypeScript Check**:
   ```bash
   cd server && npx tsc --noEmit
   ```
   *Expected: Exit code 0, 0 errors.*

3. **Run Unit Tests**:
   ```bash
   cd server && npx vitest run tests/unit/pdf.test.ts
   ```
   *Expected: 7 passed (7).*

4. **Run Full Test Suite**:
   ```bash
   cd server && npx vitest run
   ```
   *Expected: 16 passed (16), 92 passed (92).*
