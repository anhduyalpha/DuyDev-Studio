"""
Unit Tests for Answer and Solution Engine (TASK-08)
Tests AnswerSolver with MockAIProvider, adaptive batching, zero Chain-of-Thought compliance,
and 1:1 question-answer mapping integrity.
"""

import unittest
from engines.quiz.reconstruction.models import (
    ReconstructedQuestion,
    QuestionType,
    QuestionOption,
    TFSubStatement
)
from engines.quiz.ir.models import SectionType
from engines.quiz.solver.models import BatchAnswerResult, QuestionAnswerItem
from engines.quiz.solver.solver import AnswerSolver
from engines.quiz.provider.mock import MockAIProvider


class TestAnswerSolver(unittest.TestCase):
    """Test suite for Answer and Solution Engine."""

    def _create_sample_questions(self, count: int = 5) -> list[ReconstructedQuestion]:
        """Creates sample questions for testing solver."""
        questions: list[ReconstructedQuestion] = []
        for i in range(1, count + 1):
            questions.append(
                ReconstructedQuestion(
                    id=f"q_test_{i}",
                    number=i,
                    source_number=i,
                    type=QuestionType.PART_I_MCQ,
                    stem=f"Câu hỏi trắc nghiệm số {i} về Hóa học?",
                    options=[
                        QuestionOption(label="A", text="Đáp án A"),
                        QuestionOption(label="B", text="Đáp án B"),
                        QuestionOption(label="C", text="Đáp án C"),
                        QuestionOption(label="D", text="Đáp án D")
                    ],
                    source_pages=[1]
                )
            )
        return questions

    def test_solve_batch_happy_path(self):
        """Tests AnswerSolver solving a batch of questions via MockAIProvider."""
        questions = self._create_sample_questions(2)

        mock_ai = MockAIProvider(
            preset_response=BatchAnswerResult(
                batch_id="batch_ans_1",
                answers=[
                    QuestionAnswerItem(
                        question_id="q_test_1",
                        question_number=1,
                        selected_answer="B",
                        evidence="Phương án B đúng vì đây là tính chất đặc trưng của este.",
                        confidence=0.98
                    ),
                    QuestionAnswerItem(
                        question_id="q_test_2",
                        question_number=2,
                        selected_answer="D",
                        evidence="Phương án D chính xác theo bảng tuần hoàn.",
                        confidence=0.95
                    )
                ]
            )
        )

        solver = AnswerSolver(mock_ai, batch_size=5)
        answers = solver.solve_batch("batch_ans_1", questions)

        self.assertEqual(len(answers), 2)
        self.assertEqual(answers[0].question_id, "q_test_1")
        self.assertEqual(answers[0].selected_answer, "B")
        self.assertEqual(answers[1].question_id, "q_test_2")
        self.assertEqual(answers[1].selected_answer, "D")
        self.assertTrue(answers[0].is_verified)

    def test_zero_chain_of_thought_prompt_compliance(self):
        """Tests that solver prompt strictly forbids Chain-of-Thought (Rule 12)."""
        questions = self._create_sample_questions(1)
        mock_ai = MockAIProvider()
        solver = AnswerSolver(mock_ai)

        solver.solve_batch("test_prompt", questions)

        # Inspect the recorded prompt in MockAIProvider
        self.assertEqual(len(mock_ai.call_history), 1)
        sent_prompt = mock_ai.call_history[0]["user_prompt"].lower()

        # Check that no forbidden CoT instructions were given to AI
        self.assertNotIn("think step by step", sent_prompt)
        self.assertNotIn("suy nghĩ từng bước", sent_prompt)
        self.assertIn("not use chain-of-thought", sent_prompt)

    def test_solve_part_ii_true_false_and_part_iii_short(self):
        """Tests solving Part II True/False sub-statements and Part III Short-answer."""
        q_tf = ReconstructedQuestion(
            id="q_tf_1",
            number=1,
            source_number=1,
            type=QuestionType.PART_II_TF,
            stem="Phát biểu nào sau đây đúng hay sai?",
            sub_statements=[
                TFSubStatement(label="a", statement="Mệnh đề 1"),
                TFSubStatement(label="b", statement="Mệnh đề 2"),
                TFSubStatement(label="c", statement="Mệnh đề 3"),
                TFSubStatement(label="d", statement="Mệnh đề 4")
            ]
        )
        q_short = ReconstructedQuestion(
            id="q_short_2",
            number=2,
            source_number=2,
            type=QuestionType.PART_III_SHORT,
            stem="Khối lượng mol của chất X là bao nhiêu gam/mol?"
        )

        mock_ai = MockAIProvider(
            preset_response=BatchAnswerResult(
                batch_id="batch_multi",
                answers=[
                    QuestionAnswerItem(
                        question_id="q_tf_1",
                        question_number=1,
                        sub_answers={"a": True, "b": False, "c": True, "d": False},
                        evidence="Mệnh đề b sai vì phản ứng không sinh ra kết tủa."
                    ),
                    QuestionAnswerItem(
                        question_id="q_short_2",
                        question_number=2,
                        short_answer_value="88",
                        evidence="Khối lượng mol của etyl axetat là 88 g/mol."
                    )
                ]
            )
        )

        solver = AnswerSolver(mock_ai)
        answers = solver.solve_batch("batch_multi", [q_tf, q_short])

        self.assertEqual(len(answers), 2)
        # Verify Part II sub-answers
        self.assertEqual(answers[0].type, SectionType.PART_II_TF)
        self.assertEqual(answers[0].sub_answers, {"a": True, "b": False, "c": True, "d": False})
        # Verify Part III short answer value
        self.assertEqual(answers[1].type, SectionType.PART_III_SHORT)
        self.assertEqual(answers[1].short_answer_value, "88")

    def test_solve_all_partitioning_and_concurrency(self):
        """Tests that solve_all partitions questions into chunks of batch_size."""
        # 12 questions with batch_size=5 -> 3 batches (5, 5, 2)
        questions = self._create_sample_questions(12)

        def mock_generate_answers(task_name, user_prompt, system_prompt, schema, **kwargs):
            # Return answers for questions found in the prompt
            import json, re
            # Extract question IDs from prompt JSON input
            match = re.search(r"```json\s*([\s\S]*?)\s*```", user_prompt)
            data = json.loads(match.group(1)) if match else {"questions": []}
            return BatchAnswerResult(
                batch_id=task_name,
                answers=[
                    QuestionAnswerItem(
                        question_id=item["id"],
                        question_number=item["number"],
                        selected_answer="C",
                        evidence=f"Giải thích câu {item['number']}"
                    )
                    for item in data.get("questions", [])
                ]
            )

        mock_ai = MockAIProvider()
        # Patch generate_structured
        mock_ai.generate_structured = mock_generate_answers

        solver = AnswerSolver(mock_ai, batch_size=5, concurrency=3)
        all_answers = solver.solve_all(questions)

        self.assertEqual(len(all_answers), 12)
        # Verify sequential order 1..12
        for idx, ans in enumerate(all_answers, start=1):
            self.assertEqual(ans.question_number, idx)
            self.assertEqual(ans.question_id, f"q_test_{idx}")

    def test_solver_fallback_on_network_failure(self):
        """Tests that solver returns safe fallback answers when AI fails all retries."""
        questions = self._create_sample_questions(2)
        mock_failing_ai = MockAIProvider(simulate_http_500=True)

        solver = AnswerSolver(mock_failing_ai, max_retries=2)
        answers = solver.solve_batch("failing_batch", questions)

        self.assertEqual(len(answers), 2)
        self.assertFalse(answers[0].is_verified)
        self.assertIn("Không thể tạo lời giải tự động", answers[0].evidence)


if __name__ == "__main__":
    unittest.main()
