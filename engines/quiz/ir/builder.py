"""
Canonical Document IR Builder
Assembles and normalizes ReconstructedQuestion items and AnswerKeyIR records into a validated CanonicalDocumentIR.
"""

from datetime import datetime, timezone
from typing import Optional, Any

try:
    import pymupdf as fitz
except ImportError:
    import fitz

from engines.quiz.perception.models import PageRepresentation
from engines.quiz.reconstruction.models import (
    ReconstructedQuestion,
    QuestionType
)
from .models import (
    CanonicalDocumentIR,
    DocumentMetadataIR,
    PageIR,
    SectionIR,
    SectionType,
    QuestionIR,
    OptionIR,
    TFStatementIR,
    ProvenanceIR,
    LayoutHintsIR,
    AnswerKeyIR,
    RichElementIR,
    RichElementType
)
from .normalizer import normalize_text
from .rich_elements import extract_rich_elements_for_question
from .validator import validate_canonical_document_ir


class CanonicalIRBuilder:
    """
    Builder responsible for assembling, normalizing, and verifying the final Canonical Document IR.
    Ensures that raw AI outputs are transformed into a clean, strongly typed contract.
    """

    @classmethod
    def build(
        cls,
        reconstructed_questions: list[ReconstructedQuestion],
        doc_reps: list[PageRepresentation],
        answers: list[AnswerKeyIR],
        metadata: Optional[DocumentMetadataIR] = None,
        pdf_doc: Optional[fitz.Document] = None,
        crops_output_dir: Optional[str] = None,
        rich_element_attachments: Optional[dict[str, list[Any]]] = None
    ) -> CanonicalDocumentIR:
        """
        Builds, normalizes, crops assets, and validates the CanonicalDocumentIR.
        Supports rich_element_attachments from DocumentObjectGraph.
        """
        # 1. Answer Lookup Map
        ans_map: dict[str, AnswerKeyIR] = {
            a.question_id: a for a in answers
        }

        # 2. Build and Normalize QuestionIR records
        questions_ir: list[QuestionIR] = []
        for q in reconstructed_questions:
            # Map QuestionType enum to SectionType enum
            sec_type = SectionType(q.type.value)

            # Retrieve corresponding answer key if available
            ans_record = ans_map.get(q.id)

            # Normalize Options
            norm_options: list[OptionIR] = []
            for opt in q.options:
                is_corr = None
                if ans_record and ans_record.type == SectionType.PART_I_MCQ:
                    is_corr = (opt.label.upper() == ans_record.selected_answer.upper())
                norm_options.append(
                    OptionIR(
                        label=opt.label.upper(),
                        text=normalize_text(opt.text),
                        is_correct=is_corr,
                        image_path=getattr(opt, "image_path", None)
                    )
                )

            # Normalize True/False Sub-statements
            norm_statements: list[TFStatementIR] = []
            for sub in q.sub_statements:
                is_corr = None
                if ans_record and ans_record.sub_answers:
                    is_corr = ans_record.sub_answers.get(sub.label.lower())
                norm_statements.append(
                    TFStatementIR(
                        label=sub.label.lower(),
                        statement=normalize_text(sub.statement),
                        is_correct=is_corr
                    )
                )

            # Extract Rich Elements (PLAN-01 / TASK-02)
            # IR INVARIANT:
            # For every question: rich_elements = ONLY assets whose owner_question_id == question.id
            # A question with no source image MUST have: rich_elements = []
            # Do not manufacture a rich element because nearby assets exist.
            rich_elements: list[RichElementIR] = []

            # Priority 1: Attachments from DocumentObjectGraph
            q_attachments = []
            if rich_element_attachments is not None:
                if q.id in rich_element_attachments:
                    q_attachments = list(rich_element_attachments[q.id])
                elif str(q.source_number) in rich_element_attachments:
                    q_attachments = list(rich_element_attachments[str(q.source_number)])
                elif str(q.number) in rich_element_attachments:
                    q_attachments = list(rich_element_attachments[str(q.number)])
                else:
                    q_attachments = []

            # Check for visual / image-based options (e.g. chemical formulas or figures as options)
            if sec_type == SectionType.PART_I_MCQ and norm_options and q_attachments:
                has_empty_opts = any(not opt.text or opt.text.strip() in (".", "...", "•") for opt in norm_options)
                already_has_img = any(bool(opt.image_path) for opt in norm_options)
                if not already_has_img:
                    valid_att_recs = [att for att in q_attachments if getattr(att, "asset_record", None) and getattr(att.asset_record, "path", None)]
                    if len(valid_att_recs) == len(norm_options) or (has_empty_opts and len(valid_att_recs) >= len(norm_options)):
                        sorted_atts = sorted(
                            valid_att_recs,
                            key=lambda a: (
                                a.asset_record.bbox[1] if a.asset_record and a.asset_record.bbox else 0.0,
                                a.asset_record.bbox[0] if a.asset_record and a.asset_record.bbox else 0.0
                            )
                        )
                        opt_atts = sorted_atts[-len(norm_options):]
                        stem_att_ids = {a.asset_id for a in sorted_atts[:-len(norm_options)]}
                        for opt, att in zip(norm_options, opt_atts):
                            opt.image_path = att.asset_record.path
                            if opt.text.strip() in (".", "...", "•"):
                                opt.text = ""
                        q_attachments = [a for a in q_attachments if a.asset_id in stem_att_ids]

            if q_attachments:
                for att in q_attachments:
                    # IR INVARIANT:
                    # For every question: rich_elements = ONLY assets whose owner_question_id == question.id
                    owner_qid = getattr(att, "owner_question_id", None)
                    if owner_qid and owner_qid not in (q.id, str(q.source_number), str(q.number)):
                        continue
                    rec = getattr(att, "asset_record", None)
                    if rec and rec.path:
                        rec_type = getattr(rec, "type", None)
                        type_val = getattr(rec_type, "value", str(rec_type)).lower()
                        if "table" in type_val:
                            r_type = RichElementType.STRUCTURED_TABLE
                        elif "diagram" in type_val or "vector" in type_val:
                            r_type = RichElementType.DIAGRAM_VECTOR
                        else:
                            r_type = RichElementType.IMAGE_CROP

                        rich_elements.append(
                            RichElementIR(
                                element_id=f"elem_{q.id}_{att.asset_id}",
                                type=r_type,
                                source_crop_path=rec.path,
                                caption=att.caption,
                                bbox=rec.bbox,
                                page_number=rec.source_page
                            )
                        )
            elif rich_element_attachments is not None:
                # DocumentObjectGraph attachments mapping provided:
                # A question with no source image MUST have rich_elements = []
                rich_elements = []
            # Priority 2: Fallback to existing manual crop ONLY when rich_element_attachments was not provided
            elif pdf_doc and crops_output_dir and q.bboxes:
                primary_p = q.source_pages[0] if q.source_pages else 1
                rich_elements = extract_rich_elements_for_question(
                    doc=pdf_doc,
                    question_id=q.id,
                    page_number=primary_p,
                    bboxes=q.bboxes,
                    output_dir=crops_output_dir
                )

            # Auto calculate layout hints (e.g. 2 or 4 columns if options are brief)
            columns = 1
            has_opt_images = any(bool(opt.image_path) for opt in norm_options)
            if norm_options and not has_opt_images:
                max_opt_len = max(len(opt.text) for opt in norm_options)
                if max_opt_len < 12 and len(norm_options) == 4:
                    columns = 4
                elif max_opt_len < 25 and len(norm_options) in (2, 4):
                    columns = 2

            # Preserve asset bboxes in provenance if q.bboxes is empty
            q_bboxes = list(q.bboxes)
            if not q_bboxes and rich_elements:
                q_bboxes = [elem.bbox for elem in rich_elements]

            # Ensure clean stem without duplicate header
            from engines.quiz.reconstruction.post_processor import clean_question_stem
            cleaned_stem = clean_question_stem(q.stem)

            q_ir = QuestionIR(
                id=q.id,
                number=q.number,
                source_number=q.source_number,
                type=sec_type,
                stem=normalize_text(cleaned_stem),
                options=norm_options,
                sub_statements=norm_statements,
                rich_elements=rich_elements,
                layout_hints=LayoutHintsIR(columns=columns),
                provenance=ProvenanceIR(
                    source_pages=q.source_pages,
                    source_block_ids=q.source_block_ids,
                    bboxes=q_bboxes,
                    original_number=q.source_number
                ),
                confidence=q.confidence,
                warnings=q.warnings,
                source_question_number=q.source_number,
                selected_order=len(questions_ir) + 1,
                output_question_number=q.number
            )
            questions_ir.append(q_ir)

        # Build explicit question mapping records
        question_mapping = [
            {
                "source_question_number": q.source_question_number or q.source_number,
                "selected_order": q.selected_order or (idx + 1),
                "output_question_number": q.output_question_number or q.number
            }
            for idx, q in enumerate(questions_ir)
        ]

        # 3. Build Sections Grouped by SectionType
        section_groups: dict[SectionType, list[str]] = {
            SectionType.PART_I_MCQ: [],
            SectionType.PART_II_TF: [],
            SectionType.PART_III_SHORT: []
        }
        for q in questions_ir:
            section_groups[q.type].append(q.id)

        def _build_section_range_instruction(sec_type: SectionType, base_suffix: str) -> str:
            matching_qs = [q for q in questions_ir if q.type == sec_type]
            if not matching_qs:
                return ""
            min_q = min(q.number for q in matching_qs)
            max_q = max(q.number for q in matching_qs)
            if min_q == max_q:
                range_str = f"câu {min_q}"
            else:
                range_str = f"từ câu {min_q} đến câu {max_q}"
            return f"Thí sinh trả lời {range_str}. {base_suffix}".strip()

        sections: list[SectionIR] = []
        if section_groups[SectionType.PART_I_MCQ]:
            inst = _build_section_range_instruction(SectionType.PART_I_MCQ, "Mỗi câu hỏi chỉ chọn một phương án.")
            sections.append(
                SectionIR(
                    id="sec_part_i",
                    title="PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn",
                    instruction=inst,
                    type=SectionType.PART_I_MCQ,
                    question_ids=section_groups[SectionType.PART_I_MCQ]
                )
            )

        if section_groups[SectionType.PART_II_TF]:
            inst = _build_section_range_instruction(SectionType.PART_II_TF, "Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai.")
            sections.append(
                SectionIR(
                    id="sec_part_ii",
                    title="PHẦN II. Câu trắc nghiệm đúng sai",
                    instruction=inst,
                    type=SectionType.PART_II_TF,
                    question_ids=section_groups[SectionType.PART_II_TF]
                )
            )

        if section_groups[SectionType.PART_III_SHORT]:
            inst = _build_section_range_instruction(SectionType.PART_III_SHORT, "Điền kết quả chính xác vào ô trả lời.")
            sections.append(
                SectionIR(
                    id="sec_part_iii",
                    title="PHẦN III. Câu trắc nghiệm trả lời ngắn",
                    instruction=inst,
                    type=SectionType.PART_III_SHORT,
                    question_ids=section_groups[SectionType.PART_III_SHORT]
                )
            )

        # 4. Build PageIR List
        pages = [
            PageIR(
                page_number=rep.page_number,
                width=rep.width,
                height=rep.height,
                kind=rep.page_kind.value
            )
            for rep in doc_reps
        ]

        # 5. Build Default Metadata if Not Provided
        if metadata is None:
            metadata = DocumentMetadataIR(
                title="BÀI TẬP TRẮC NGHIỆM CHUẨN HÓA",
                subject="HÓA HỌC",
                total_questions=len(questions_ir),
                created_at=datetime.now(timezone.utc).isoformat()
            )
        else:
            metadata.total_questions = len(questions_ir)

        # 6. Normalize Evidence in AnswerKeyIR
        normalized_answers: list[AnswerKeyIR] = []
        for ans in answers:
            normalized_answers.append(
                ans.model_copy(
                    update={"evidence": normalize_text(ans.evidence)}
                )
            )

        doc_ir = CanonicalDocumentIR(
            metadata=metadata,
            pages=pages,
            sections=sections,
            questions=questions_ir,
            answers=normalized_answers,
            question_mapping=question_mapping
        )

        # 7. Execute Strict Integrity Validation
        validate_canonical_document_ir(doc_ir)

        return doc_ir
