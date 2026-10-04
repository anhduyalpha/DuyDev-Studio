"""
Canonical Document IR Builder
Assembles and normalizes ReconstructedQuestion items and AnswerKeyIR records into a validated CanonicalDocumentIR.
"""

from datetime import datetime, timezone
from typing import Optional

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
    AnswerKeyIR
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
        crops_output_dir: Optional[str] = None
    ) -> CanonicalDocumentIR:
        """
        Builds, normalizes, crops assets, and validates the CanonicalDocumentIR.
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
                        is_correct=is_corr
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

            # Extract Rich Element crops if PDF doc and directory are supplied
            rich_elements = []
            if pdf_doc and crops_output_dir and q.bboxes:
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
            if norm_options:
                max_opt_len = max(len(opt.text) for opt in norm_options)
                if max_opt_len < 12 and len(norm_options) == 4:
                    columns = 4
                elif max_opt_len < 25 and len(norm_options) in (2, 4):
                    columns = 2

            q_ir = QuestionIR(
                id=q.id,
                number=q.number,
                source_number=q.source_number,
                type=sec_type,
                stem=normalize_text(q.stem),
                options=norm_options,
                sub_statements=norm_statements,
                rich_elements=rich_elements,
                layout_hints=LayoutHintsIR(columns=columns),
                provenance=ProvenanceIR(
                    source_pages=q.source_pages,
                    source_block_ids=q.source_block_ids,
                    bboxes=q.bboxes,
                    original_number=q.source_number
                ),
                confidence=q.confidence,
                warnings=q.warnings
            )
            questions_ir.append(q_ir)

        # 3. Build Sections Grouped by SectionType
        section_groups: dict[SectionType, list[str]] = {
            SectionType.PART_I_MCQ: [],
            SectionType.PART_II_TF: [],
            SectionType.PART_III_SHORT: []
        }
        for q in questions_ir:
            section_groups[q.type].append(q.id)

        sections: list[SectionIR] = []
        if section_groups[SectionType.PART_I_MCQ]:
            sections.append(
                SectionIR(
                    id="sec_part_i",
                    title="PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn",
                    instruction="Thí sinh trả lời từ câu 1 đến câu N. Mỗi câu hỏi chỉ chọn một phương án.",
                    type=SectionType.PART_I_MCQ,
                    question_ids=section_groups[SectionType.PART_I_MCQ]
                )
            )

        if section_groups[SectionType.PART_II_TF]:
            sections.append(
                SectionIR(
                    id="sec_part_ii",
                    title="PHẦN II. Câu trắc nghiệm đúng sai",
                    instruction="Thí sinh trả lời từ câu 1 đến câu N. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai.",
                    type=SectionType.PART_II_TF,
                    question_ids=section_groups[SectionType.PART_II_TF]
                )
            )

        if section_groups[SectionType.PART_III_SHORT]:
            sections.append(
                SectionIR(
                    id="sec_part_iii",
                    title="PHẦN III. Câu trắc nghiệm trả lời ngắn",
                    instruction="Thí sinh trả lời từ câu 1 đến câu N. Điền kết quả chính xác vào ô trả lời.",
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
            answers=normalized_answers
        )

        # 7. Execute Strict Integrity Validation
        validate_canonical_document_ir(doc_ir)

        return doc_ir
