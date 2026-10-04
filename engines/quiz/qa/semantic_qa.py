"""
Deterministic Semantic QA Engine.
Verifies PDF file existence, 1:1 question-answer mapping, sequential question numbering,
and option cardinality compliance.
"""

import os
from engines.quiz.ir.models import CanonicalDocumentIR, SectionType
from engines.quiz.qa.models import (
    SemanticQAResult,
    QAIssue,
    QAIssueType,
    QASeverity,
)


def validate_semantic_integrity(
    doc_ir: CanonicalDocumentIR,
    debai_pdf: str,
    dapan_pdf: str,
) -> SemanticQAResult:
    """
    Deterministically verify structural integrity, question-answer matching,
    and output file existence.
    """
    issues: list[QAIssue] = []

    # 1. Output PDF Existence & Minimum Size Checks
    if not os.path.isfile(debai_pdf) or os.path.getsize(debai_pdf) < 1024:
        issues.append(
            QAIssue(
                page=0,
                type=QAIssueType.MISSING_FILE,
                severity=QASeverity.CRITICAL,
                description=f"Worksheet PDF does not exist or is empty (< 1024 bytes): {debai_pdf}",
            )
        )

    if not os.path.isfile(dapan_pdf) or os.path.getsize(dapan_pdf) < 1024:
        issues.append(
            QAIssue(
                page=0,
                type=QAIssueType.MISSING_FILE,
                severity=QASeverity.CRITICAL,
                description=f"Answer Key PDF does not exist or is empty (< 1024 bytes): {dapan_pdf}",
            )
        )

    # 2. Sequential Question Numbering (1..N)
    total_q = len(doc_ir.questions)
    seq_valid = True
    for idx, q in enumerate(doc_ir.questions, start=1):
        if q.number != idx:
            seq_valid = False
            issues.append(
                QAIssue(
                    page=0,
                    type=QAIssueType.CARDINALITY_MISMATCH,
                    severity=QASeverity.HIGH,
                    description=f"Question at index {idx} has non-sequential number: {q.number} (expected {idx}).",
                )
            )

    # 3. 1:1 Question-to-Answer Mapping Verification
    q_ids = {q.id for q in doc_ir.questions}
    ans_map = {a.question_id: a for a in doc_ir.answers}

    matched_answers = 0
    for q in doc_ir.questions:
        if q.id not in ans_map:
            issues.append(
                QAIssue(
                    page=0,
                    type=QAIssueType.ANSWER_MISMATCH,
                    severity=QASeverity.CRITICAL,
                    description=f"Question '{q.id}' (Câu {q.number}) has no corresponding answer record in Answer Key.",
                )
            )
        else:
            matched_answers += 1

    # Check for orphan answers
    for a in doc_ir.answers:
        if a.question_id not in q_ids:
            issues.append(
                QAIssue(
                    page=0,
                    type=QAIssueType.ANSWER_MISMATCH,
                    severity=QASeverity.CRITICAL,
                    description=f"Answer record for question ID '{a.question_id}' (Câu {a.question_number}) has no matching question in Worksheet.",
                )
            )

    # 4. Option & Sub-statement Cardinality Check
    for q in doc_ir.questions:
        if q.type == SectionType.PART_I_MCQ:
            if not (2 <= len(q.options) <= 4):
                issues.append(
                    QAIssue(
                        page=0,
                        type=QAIssueType.CARDINALITY_MISMATCH,
                        severity=QASeverity.HIGH,
                        description=f"Part I question '{q.id}' (Câu {q.number}) has invalid option count: {len(q.options)} (expected 2-4).",
                    )
                )
        elif q.type == SectionType.PART_II_TF:
            if len(q.sub_statements) != 4:
                issues.append(
                    QAIssue(
                        page=0,
                        type=QAIssueType.CARDINALITY_MISMATCH,
                        severity=QASeverity.HIGH,
                        description=f"Part II True/False question '{q.id}' (Câu {q.number}) has invalid statement count: {len(q.sub_statements)} (expected 4).",
                    )
                )

    status = "FAIL" if issues else "PASS"

    return SemanticQAResult(
        status=status,
        issues=issues,
        total_questions=total_q,
        matched_answers=matched_answers,
        is_sequence_valid=seq_valid,
    )
