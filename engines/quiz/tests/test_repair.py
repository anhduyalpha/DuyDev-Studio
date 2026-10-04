"""
Unit Tests for Safe Repair Engine (TASK-10).
"""

import unittest
from engines.quiz.ir.models import (
    CanonicalDocumentIR,
    DocumentMetadataIR,
    SectionType,
    QuestionIR,
    OptionIR,
    AnswerKeyIR,
)
from engines.quiz.rendering.styles import BLUE_BLACK_CLASSIC_STYLE
from engines.quiz.qa.models import (
    OverallQAResult,
    GeometryQAResult,
    SemanticQAResult,
    QAIssue,
    QAIssueType,
    QASeverity,
)
from engines.quiz.qa.repair import SafeRepairEngine


class TestSafeRepairEngine(unittest.TestCase):
    def setUp(self):
        self.doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(
                title="ĐỀ THI THỬ",
                subject="HÓA HỌC",
                total_questions=1,
                created_at="2026-10-04T12:00:00Z",
            ),
            questions=[
                QuestionIR(
                    id="q_1",
                    number=1,
                    source_number=1,
                    type=SectionType.PART_I_MCQ,
                    stem="Nội dung câu hỏi bài tập este hóa",
                    options=[
                        OptionIR(label="A", text="Đáp án 1"),
                        OptionIR(label="B", text="Đáp án 2"),
                        OptionIR(label="C", text="Đáp án 3"),
                        OptionIR(label="D", text="Đáp án 4"),
                    ],
                )
            ],
            answers=[
                AnswerKeyIR(
                    question_id="q_1",
                    question_number=1,
                    type=SectionType.PART_I_MCQ,
                    selected_answer="A",
                    evidence="Phương pháp giải bài toán este",
                )
            ],
        )
        self.preset = BLUE_BLACK_CLASSIC_STYLE.model_copy()

    def test_safe_repair_overflow_tightens_margins_and_font(self):
        qa_result = OverallQAResult(
            status="FAIL",
            geometry=GeometryQAResult(
                status="FAIL",
                issues=[
                    QAIssue(
                        page=1,
                        type=QAIssueType.OVERFLOW,
                        severity=QASeverity.HIGH,
                        description="Content overflows bottom boundary.",
                    )
                ],
            ),
            semantic=SemanticQAResult(status="PASS"),
            requires_repair=True,
        )

        orig_margin = self.preset.margin_top_mm
        orig_font_size = self.preset.font_size_pt

        new_ir, new_preset, was_repaired = SafeRepairEngine.evaluate_and_repair(
            doc_ir=self.doc_ir,
            style_preset=self.preset,
            qa_result=qa_result,
            current_iteration=0,
            max_iterations=2,
        )

        self.assertTrue(was_repaired)
        # Margin and font size should be tightened
        self.assertLess(new_preset.margin_top_mm, orig_margin)
        self.assertLess(new_preset.font_size_pt, orig_font_size)
        # Question stem and answers must be completely preserved
        self.assertEqual(new_ir.questions[0].stem, self.doc_ir.questions[0].stem)
        self.assertEqual(new_ir.answers[0].selected_answer, self.doc_ir.answers[0].selected_answer)

    def test_safe_repair_split_question_compacts_spacing(self):
        qa_result = OverallQAResult(
            status="FAIL",
            geometry=GeometryQAResult(
                status="FAIL",
                issues=[
                    QAIssue(
                        page=1,
                        type=QAIssueType.SPLIT_QUESTION,
                        severity=QASeverity.HIGH,
                        description="Question split across page boundary.",
                    )
                ],
            ),
            semantic=SemanticQAResult(status="PASS"),
            requires_repair=True,
        )

        new_ir, new_preset, was_repaired = SafeRepairEngine.evaluate_and_repair(
            doc_ir=self.doc_ir,
            style_preset=self.preset,
            qa_result=qa_result,
            current_iteration=1,
            max_iterations=2,
        )
        self.assertTrue(was_repaired)
        # In iteration >= 1 with split question, student info box is hidden
        self.assertFalse(new_preset.show_student_info)

    def test_safe_repair_stops_after_max_iterations(self):
        qa_result = OverallQAResult(
            status="FAIL",
            geometry=GeometryQAResult(
                status="FAIL",
                issues=[
                    QAIssue(
                        page=1,
                        type=QAIssueType.OVERFLOW,
                        severity=QASeverity.HIGH,
                        description="Persistent overflow.",
                    )
                ],
            ),
            semantic=SemanticQAResult(status="PASS"),
            requires_repair=True,
        )

        # Calling with current_iteration == max_iterations
        new_ir, new_preset, was_repaired = SafeRepairEngine.evaluate_and_repair(
            doc_ir=self.doc_ir,
            style_preset=self.preset,
            qa_result=qa_result,
            current_iteration=2,
            max_iterations=2,
        )
        self.assertFalse(was_repaired)


if __name__ == "__main__":
    unittest.main()
