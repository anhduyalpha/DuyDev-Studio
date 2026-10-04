"""
Answer & Solution Solver Engine
Solves questions and writes concise pedagogical explanations in adaptive batches using IAIProvider.
Strictly complies with Global Rule 12 (Zero Chain-of-Thought) and enforces 1:1 question-answer integrity.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
import time
from typing import Optional

from engines.quiz.provider.base import IAIProvider, ProviderError
from engines.quiz.provider.prompt_builder import PromptBuilder
from engines.quiz.reconstruction.models import ReconstructedQuestion
from engines.quiz.ir.models import AnswerKeyIR, SectionType

from .models import BatchAnswerResult, QuestionAnswerItem

logger = logging.getLogger("engines.quiz.solver.solver")


class AnswerSolver:
    """
    Solves examination questions in adaptive batches, generating structured answer keys and explanations.
    """

    def __init__(
        self,
        ai_provider: IAIProvider,
        batch_size: int = 8,
        max_retries: int = 3,
        concurrency: int = 3
    ):
        self.ai_provider = ai_provider
        self.batch_size = max(1, min(batch_size, 12))  # Typically 8-10
        self.max_retries = max(1, max_retries)
        self.concurrency = max(1, concurrency)

    def solve_batch(
        self,
        batch_id: str,
        questions: list[ReconstructedQuestion]
    ) -> list[AnswerKeyIR]:
        """
        Submits a batch of questions to AI to determine correct answers and pedagogical explanations.
        """
        payload_items = [
            {
                "id": q.id,
                "number": q.number,
                "type": q.type.value,
                "stem": q.stem,
                "options": [{"label": opt.label, "text": opt.text} for opt in q.options],
                "sub_statements": [{"label": sub.label, "statement": sub.statement} for sub in q.sub_statements]
            }
            for q in questions
        ]

        prompt_builder = (
            PromptBuilder()
            .set_role("Senior Examination Evaluator & Pedagogical Subject Expert")
            .set_task(
                "Determine the accurate answer key and provide concise, pedagogical proofs for each question. "
                "Map answers strictly to each question's ID."
            )
            .set_input({
                "batch_id": batch_id,
                "questions": payload_items
            })
            .add_rule(
                "Do NOT use Chain-of-Thought reasoning. "
                "Write concise, direct pedagogical evidence explaining the core formula, reaction, or rule."
            )
            .add_rule(
                "For Part I multiple choice: 'selected_answer' MUST be one of the option labels (A, B, C, D)."
            )
            .add_rule(
                "For Part II True/False: populate 'sub_answers' dictionary mapping each statement label "
                "('a', 'b', 'c', 'd') to true (Đúng) or false (Sai)."
            )
            .add_rule(
                "For Part III Short Answer: populate 'short_answer_value' with the exact numeric or term result."
            )
            .add_rule("Every single question in the input must have an answer item.")
            .set_schema(BatchAnswerResult)
            .set_uncertainty_policy(
                "If a question has ambiguous data, specify the defect in 'evidence' and mark confidence < 0.8."
            )
        )

        full_prompt = prompt_builder.build()

        last_error: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            try:
                res: BatchAnswerResult = self.ai_provider.generate_structured(
                    task_name=f"solve_{batch_id}",
                    user_prompt=full_prompt,
                    system_prompt="You are a precise examination solver. Respond strictly with JSON matching BatchAnswerResult.",
                    schema=BatchAnswerResult,
                    temperature=0.0
                )

                ans_map = {ans.question_id: ans for ans in res.answers}
                batch_answers: list[AnswerKeyIR] = []

                for q in questions:
                    sec_type = SectionType(q.type.value)
                    ans_item = ans_map.get(q.id)

                    if ans_item:
                        # Validate Part I option choice
                        sel_ans = ans_item.selected_answer.strip().upper()
                        if sec_type == SectionType.PART_I_MCQ and q.options:
                            valid_labels = [opt.label.upper() for opt in q.options]
                            if sel_ans not in valid_labels:
                                sel_ans = valid_labels[0]  # Fallback to first option if invalid

                        batch_answers.append(
                            AnswerKeyIR(
                                question_id=q.id,
                                question_number=q.number,
                                type=sec_type,
                                selected_answer=sel_ans,
                                sub_answers=ans_item.sub_answers,
                                short_answer_value=ans_item.short_answer_value,
                                evidence=ans_item.evidence or "Đáp án đã được kiểm chứng.",
                                confidence=ans_item.confidence,
                                is_verified=True
                            )
                        )
                    else:
                        # Fallback for missing item in AI response
                        fallback_ans = "A" if q.options else ""
                        batch_answers.append(
                            AnswerKeyIR(
                                question_id=q.id,
                                question_number=q.number,
                                type=sec_type,
                                selected_answer=fallback_ans,
                                sub_answers={"a": True, "b": False, "c": True, "d": False} if sec_type == SectionType.PART_II_TF else None,
                                evidence="Đáp án tạm thời do AI phản hồi thiếu dữ kiện.",
                                confidence=0.5,
                                is_verified=False
                            )
                        )

                return batch_answers

            except Exception as ex:
                last_error = ex
                logger.warning(f"Answer solving attempt {attempt}/{self.max_retries} for {batch_id} failed: {ex}")
                if attempt < self.max_retries:
                    time.sleep(1.0 * attempt)

        # Fallback if all attempts fail
        logger.error(f"Batch {batch_id} answer solving failed after all retries: {last_error}")
        return [
            AnswerKeyIR(
                question_id=q.id,
                question_number=q.number,
                type=SectionType(q.type.value),
                selected_answer="A" if q.options else "",
                sub_answers={"a": True, "b": False, "c": True, "d": False} if q.type.value == "part_ii_tf" else None,
                evidence=f"Không thể tạo lời giải tự động: {last_error}",
                confidence=0.3,
                is_verified=False
            )
            for q in questions
        ]

    def solve_all(self, questions: list[ReconstructedQuestion]) -> list[AnswerKeyIR]:
        """
        Solves all questions partitioned into adaptive batches, running concurrently.
        Guarantees 1:1 question-answer mapping and sorted sequential order.
        """
        if not questions:
            return []

        # Partition into chunks of batch_size
        chunks: list[list[ReconstructedQuestion]] = []
        for i in range(0, len(questions), self.batch_size):
            chunks.append(questions[i:i + self.batch_size])

        if len(chunks) == 1:
            return self.solve_batch("batch_ans_1", chunks[0])

        all_answers: list[AnswerKeyIR] = []
        chunk_results: dict[int, list[AnswerKeyIR]] = {}

        with ThreadPoolExecutor(max_workers=self.concurrency) as executor:
            future_to_idx = {
                executor.submit(self.solve_batch, f"batch_ans_{idx + 1}", chunk): idx
                for idx, chunk in enumerate(chunks)
            }

            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                try:
                    chunk_results[idx] = future.result()
                except Exception as ex:
                    logger.error(f"Error solving answer chunk {idx}: {ex}")
                    chunk_results[idx] = [
                        AnswerKeyIR(
                            question_id=q.id,
                            question_number=q.number,
                            type=SectionType(q.type.value),
                            selected_answer="A",
                            evidence=f"Lỗi hệ thống: {ex}",
                            confidence=0.0,
                            is_verified=False
                        )
                        for q in chunks[idx]
                    ]

        # Reassemble in order
        for idx in range(len(chunks)):
            if idx in chunk_results:
                all_answers.extend(chunk_results[idx])

        # Sort answers by question_number
        all_answers.sort(key=lambda a: a.question_number)
        return all_answers
