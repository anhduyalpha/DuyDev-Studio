"""
Question Reconstructor Module
Orchestrates parallel multi-threaded batch execution via IAIProvider, isolated per-batch retries,
and graceful code-based degradation fallbacks.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
import re
import time
from typing import Optional

from engines.quiz.provider.base import IAIProvider, ProviderError
from engines.quiz.provider.prompt_builder import PromptBuilder

from .models import (
    BatchPayload,
    BatchReconstructionResult,
    ReconstructedQuestion,
    QuestionType,
    QuestionOption
)

logger = logging.getLogger("engines.quiz.reconstruction.reconstructor")


class QuestionReconstructor:
    """
    Executes batched question reconstruction across multiple threads.
    Guarantees isolated retries per batch and fallback degradation to code heuristics.
    """

    def __init__(self, ai_provider: IAIProvider, concurrency: int = 4, max_batch_retries: int = 3):
        self.ai_provider = ai_provider
        self.concurrency = max(1, concurrency)
        self.max_batch_retries = max(1, max_batch_retries)

    def reconstruct_batch(self, batch: BatchPayload) -> list[ReconstructedQuestion]:
        """
        Executes a single BatchPayload with bounded isolated retries and graceful fallback.
        """
        prompt_builder = (
            PromptBuilder()
            .set_role("Senior Vietnamese Examination Data Extractor & Layout Engineer")
            .set_task(
                "Reconstruct raw examination text blocks into structured question records. "
                "Classify question sections (Part I MCQ, Part II True/False, Part III Short answer), "
                "and stitch together any split questions that span across page boundaries."
            )
            .set_input({
                "batch_id": batch.batch_id,
                "target_question_numbers": batch.target_question_numbers,
                "source_page_numbers": batch.page_numbers,
                "text_content": batch.text_content,
                "neighboring_prev_context": batch.neighboring_prev_context,
                "neighboring_next_context": batch.neighboring_next_context
            })
            .add_rule("Never invent or hallucinate questions not found in the input text.")
            .add_rule("Do NOT repeat or prepend question numbering prefix (such as 'Câu 1:', 'Câu 35:') in the 'stem' field.")
            .add_rule("Do NOT generate answers or explanations in this step (solving is handled in a later phase).")
            .add_rule("Preserve all mathematical formulas in KaTeX/LaTeX format and chemical notations.")
            .add_rule("Preserve image references [IMAGE_REF: ...].")
            .add_rule(
                "If a question begins at the end of the previous page context or options continue into "
                "the next page context, stitch the stem and options together into ONE complete question."
            )
            .add_rule(
                "Classify 'type' as 'part_i_mcq' (4 options A,B,C,D), 'part_ii_tf' (True/False 4 sub-statements), "
                "or 'part_iii_short' (short answer). Ignore or omit section headers."
            )
            .set_schema(BatchReconstructionResult)
            .set_uncertainty_policy(
                "If a question is ambiguous or partially obscured, record evidence in 'warnings' "
                "and set confidence < 0.8. Never guess missing options."
            )
        )

        full_prompt = prompt_builder.build()

        # Check AI Reconstruct Cache first (bypass if simulated errors are injected)
        has_simulated_error = (
            getattr(self.ai_provider, "simulate_http_500", False) or
            getattr(self.ai_provider, "simulate_timeout", False) or
            getattr(self.ai_provider, "simulate_http_401", False) or
            getattr(self.ai_provider, "simulate_http_429", False) or
            getattr(self.ai_provider, "simulate_missing_fields", False) or
            getattr(self.ai_provider, "simulate_malformed_json", False) or
            getattr(self.ai_provider, "failure_count_before_success", 0) > 0
        )

        import hashlib
        from engines.quiz.quiz_cache import get_ai_reconstruct_cache, set_ai_reconstruct_cache, is_provider_cache_enabled

        batch_key = hashlib.sha256((batch.text_content + "v3.0.0").encode("utf-8")).hexdigest()
        if not has_simulated_error and is_provider_cache_enabled(self.ai_provider):
            cached_result = get_ai_reconstruct_cache(batch_key)
            if cached_result and isinstance(cached_result, dict):
                try:
                    res_obj = BatchReconstructionResult.model_validate(cached_result)
                    if hasattr(self.ai_provider, "tracker") and hasattr(self.ai_provider.tracker, "record_cache_hit"):
                        self.ai_provider.tracker.record_cache_hit(1)
                    if hasattr(self.ai_provider, "tracker") and hasattr(self.ai_provider.tracker, "record_batch"):
                        self.ai_provider.tracker.record_batch(1)
                    valid_questions = [
                        q for q in res_obj.questions
                        if q.type != QuestionType.SECTION_HEADER
                    ]
                    for q in valid_questions:
                        if not q.source_pages:
                            q.source_pages = list(batch.page_numbers)
                    return valid_questions
                except Exception:
                    pass

        # Isolated Bounded Retry for this specific batch
        last_error: Optional[Exception] = None
        for attempt in range(1, self.max_batch_retries + 1):
            try:
                result: BatchReconstructionResult = self.ai_provider.generate_structured(
                    task_name=f"reconstruct_{batch.batch_id}",
                    user_prompt=full_prompt,
                    system_prompt="You are an expert exam layout engineer. Respond strictly with JSON matching BatchReconstructionResult.",
                    schema=BatchReconstructionResult,
                    image_bytes=batch.image_bytes if batch.has_visuals else None,
                    temperature=0.0
                )
                valid_questions = [
                    q for q in result.questions
                    if q.type != QuestionType.SECTION_HEADER
                ]
                for q in valid_questions:
                    if not q.source_pages:
                        q.source_pages = list(batch.page_numbers)
                if is_provider_cache_enabled(self.ai_provider):
                    set_ai_reconstruct_cache(batch_key, result.model_dump())
                if hasattr(self.ai_provider, "tracker") and hasattr(self.ai_provider.tracker, "record_batch"):
                    self.ai_provider.tracker.record_batch(1)
                return valid_questions

            except Exception as ex:
                last_error = ex
                logger.warning(
                    f"Batch {batch.batch_id} attempt {attempt}/{self.max_batch_retries} failed: {ex}"
                )
                if attempt < self.max_batch_retries:
                    time.sleep(1.0 * attempt)

        # Fallback Graceful Degradation: parse using code regex heuristics
        logger.error(
            f"Batch {batch.batch_id} exhausted all {self.max_batch_retries} retries. "
            f"Engaging code fallback. Reason: {last_error}"
        )
        return self._fallback_code_reconstruction(batch, str(last_error))

    def reconstruct_all(self, batches: list[BatchPayload]) -> list[ReconstructedQuestion]:
        """
        Executes all planned batches concurrently using ThreadPoolExecutor.
        Maintains order of completed batches.
        """
        if not batches:
            return []

        if len(batches) == 1:
            return self.reconstruct_batch(batches[0])

        all_questions: list[ReconstructedQuestion] = []
        batch_results: dict[int, list[ReconstructedQuestion]] = {}

        with ThreadPoolExecutor(max_workers=self.concurrency) as executor:
            future_to_idx = {
                executor.submit(self.reconstruct_batch, batch): idx
                for idx, batch in enumerate(batches)
            }

            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                try:
                    questions = future.result()
                    batch_results[idx] = questions
                except Exception as ex:
                    logger.error(f"Batch index {idx} failed with unhandled exception: {ex}")
                    batch_results[idx] = self._fallback_code_reconstruction(batches[idx], str(ex))

        # Re-assemble in original planned batch order
        for idx in range(len(batches)):
            if idx in batch_results:
                all_questions.extend(batch_results[idx])

        return all_questions

    def _fallback_code_reconstruction(
        self,
        batch: BatchPayload,
        error_msg: str
    ) -> list[ReconstructedQuestion]:
        """
        Fallback deterministic parser extracting basic questions when AI batch fails completely.
        Prevents full job failure (Graceful degradation).
        """
        fallback_questions: list[ReconstructedQuestion] = []
        try:
            from engines.quiz.mcq_parser import parse_mcq_blocks
            parsed_blocks = parse_mcq_blocks(batch.text_content)
            if parsed_blocks:
                for blk in parsed_blocks:
                    q_num = blk["source_number"]
                    opts = [
                        QuestionOption(label=lbl, text=blk["options"][lbl])
                        for lbl in ["A", "B", "C", "D"]
                        if blk["options"].get(lbl)
                    ]
                    clean_stem = blk.get("clean_stem") or blk.get("stem", "")
                    fallback_questions.append(
                        ReconstructedQuestion(
                            id=f"fallback_b{batch.batch_id}_q{q_num}",
                            number=q_num,
                            source_number=q_num,
                            type=QuestionType.PART_I_MCQ,
                            stem=clean_stem,
                            options=opts,
                            source_pages=list(batch.page_numbers),
                            confidence=0.5,
                            warnings=[f"Tạo bằng thuật toán dự phòng do AI thất bại: {error_msg}"]
                        )
                    )
                if fallback_questions:
                    return fallback_questions
        except Exception as ex:
            logger.warning(f"mcq_parser fallback in reconstructor failed: {ex}")

        pat = re.compile(r"(?:^|\n)\s*(?:Câu|Bài|Question)\s*(\d+)[\s\.\:\)]", re.IGNORECASE)
        matches = list(pat.finditer(batch.text_content))

        opt_regex = re.compile(r"\b([A-D])[\.\)]\s*([^\n\rA-D\.]+)", re.IGNORECASE)

        for i, m in enumerate(matches):
            try:
                q_num = int(m.group(1))
            except ValueError:
                q_num = i + 1

            start_pos = m.end()
            end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(batch.text_content)
            body = batch.text_content[start_pos:end_pos].strip()

            options: list[QuestionOption] = []
            for opt_label, opt_text in opt_regex.findall(body):
                options.append(QuestionOption(label=opt_label.upper(), text=opt_text.strip()))

            clean_body = re.sub(r"^(?:Câu\s*\d+[\.\:\)\s]*|\b\d+[\.\:]\s*)", "", body, flags=re.IGNORECASE).strip()
            # If options found, strip them from stem
            first_opt = opt_regex.search(clean_body)
            stem_text = clean_body[:first_opt.start()].strip() if first_opt else clean_body

            fallback_questions.append(
                ReconstructedQuestion(
                    id=f"fallback_b{batch.batch_id}_q{q_num}",
                    number=q_num,
                    source_number=q_num,
                    type=QuestionType.PART_I_MCQ,
                    stem=stem_text,
                    options=options,
                    source_pages=list(batch.page_numbers),
                    confidence=0.5,
                    warnings=[f"Tạo bằng thuật toán dự phòng do AI thất bại: {error_msg}"]
                )
            )

        return fallback_questions
