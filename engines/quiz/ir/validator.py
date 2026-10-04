"""
Canonical Document IR Integrity Validator
Strict gatekeeper validating 100% compliance with IR schema, cardinality, 1:1 question-answer mapping,
and non-overlapping unique identifiers before passing data to downstream renderers.
"""

from typing import Optional
from .models import CanonicalDocumentIR, SectionType, SchemaVersion


class IRValidationError(Exception):
    """Raised when Canonical Document IR fails structural or business integrity checks."""
    def __init__(self, message: str, details: Optional[dict] = None):
        super().__init__(message)
        self.details = details or {}


def validate_canonical_document_ir(doc_ir: CanonicalDocumentIR) -> None:
    """
    Validates the CanonicalDocumentIR instance against strict production constraints:
    1. Schema version must be 3.0.0
    2. Zero duplicate question IDs
    3. Exact 1:1 mapping between questions and answers
    4. Valid option cardinality per question type
    5. Valid confidence scores (0.0 .. 1.0)
    6. Valid section question references
    """
    # 1. Schema Version Check
    if doc_ir.schema_version != SchemaVersion.V3_0_0:
        raise IRValidationError(
            f"Unsupported schema version '{doc_ir.schema_version}'. Expected '{SchemaVersion.V3_0_0}'."
        )

    # 2. Metadata Count Integrity
    if doc_ir.metadata.total_questions != len(doc_ir.questions):
        raise IRValidationError(
            f"Metadata total_questions ({doc_ir.metadata.total_questions}) "
            f"does not match actual question count ({len(doc_ir.questions)})."
        )

    # 3. Question IDs Uniqueness and Confidence Bounds
    seen_q_ids: set[str] = set()
    q_id_map = {}

    for q in doc_ir.questions:
        if not q.id or not q.id.strip():
            raise IRValidationError(f"Question at index {q.number} has empty or invalid ID.")

        if q.id in seen_q_ids:
            raise IRValidationError(f"Duplicate question ID detected: '{q.id}'.")
        seen_q_ids.add(q.id)
        q_id_map[q.id] = q

        # Confidence bounds check
        if not (0.0 <= q.confidence <= 1.0):
            raise IRValidationError(
                f"Question '{q.id}' has invalid confidence {q.confidence} (must be between 0.0 and 1.0)."
            )

        # 4. Option Cardinality Verification
        if q.type == SectionType.PART_I_MCQ:
            if not (2 <= len(q.options) <= 4):
                raise IRValidationError(
                    f"Question '{q.id}' (Part I) has invalid option cardinality: {len(q.options)} (must be 2..4)."
                )
            if len(q.options) == 3:
                raise IRValidationError(
                    f"Question '{q.id}' (Part I, Câu {q.number}) has missing option: found only 3 options (expected 4). Content integrity invariant violated."
                )
        elif q.type == SectionType.PART_II_TF:
            if len(q.sub_statements) != 4:
                raise IRValidationError(
                    f"Question '{q.id}' (Part II) must have exactly 4 sub-statements (found {len(q.sub_statements)})."
                )

    # 5. Exact 1:1 Question-Answer Mapping
    seen_ans_ids: set[str] = set()
    for ans in doc_ir.answers:
        if ans.question_id in seen_ans_ids:
            raise IRValidationError(
                f"Duplicate answer key record detected for question ID '{ans.question_id}'."
            )
        seen_ans_ids.add(ans.question_id)

        # Verify answer confidence bounds
        if not (0.0 <= ans.confidence <= 1.0):
            raise IRValidationError(
                f"Answer for '{ans.question_id}' has invalid confidence {ans.confidence}."
            )

        # Validate Part I answer choice matches one of the option labels
        if ans.type == SectionType.PART_I_MCQ and ans.question_id in q_id_map:
            q_ref = q_id_map[ans.question_id]
            valid_labels = [opt.label.upper() for opt in q_ref.options]
            if ans.selected_answer.upper() not in valid_labels:
                raise IRValidationError(
                    f"Answer choice '{ans.selected_answer}' for question '{ans.question_id}' "
                    f"is not in available options {valid_labels}."
                )

    # Check for missing answers
    missing_answers = seen_q_ids - seen_ans_ids
    if missing_answers:
        sample_missing = sorted(list(missing_answers))[:5]
        raise IRValidationError(
            f"Missing answers for {len(missing_answers)} questions (e.g. {sample_missing})."
        )

    # Check for orphaned answers
    orphaned_answers = seen_ans_ids - seen_q_ids
    if orphaned_answers:
        sample_orphaned = sorted(list(orphaned_answers))[:5]
        raise IRValidationError(
            f"Orphaned answers without matching question ID: {sample_orphaned}."
        )

    # 6. Section Reference Verification
    for sec in doc_ir.sections:
        for ref_id in sec.question_ids:
            if ref_id not in seen_q_ids:
                raise IRValidationError(
                    f"Section '{sec.id}' references non-existent question ID '{ref_id}'."
                )
