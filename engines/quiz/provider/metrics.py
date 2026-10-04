"""
AI Call Budget & Performance Telemetry Tracker (TASK-13 & Global Rule 14).
Enforces sub-linear AI scaling bounds, tracks multimodal vision spend, and collects latency profiles.
"""

import math
import threading
from typing import Any, Optional


class AICallBudgetTracker:
    """
    Thread-safe telemetry tracker for AI inference calls, retries, and vision usage.
    Enforces regression failure when AI calls exceed bounded budget.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.ai_calls: int = 0
        self.vision_calls: int = 0
        self.batches: int = 0
        self.retries: int = 0
        self.cache_hits: int = 0
        self.total_latency_ms: float = 0.0
        self.call_history: list[dict[str, Any]] = []

    @property
    def metrics(self) -> "AICallBudgetTracker":
        return self

    def record_call(
        self,
        task_name: str,
        latency_ms: float,
        is_vision: bool = False,
        is_retry: bool = False,
    ) -> None:
        """Records a completed AI inference request."""
        with self._lock:
            self.ai_calls += 1
            if is_vision:
                self.vision_calls += 1
            if is_retry:
                self.retries += 1
            self.total_latency_ms += latency_ms
            self.call_history.append({
                "task_name": task_name,
                "latency_ms": round(latency_ms, 2),
                "is_vision": is_vision,
                "is_retry": is_retry,
            })

    def record_batch(self, count: int = 1) -> None:
        """Increments processed batch counter."""
        with self._lock:
            self.batches += count

    def record_cache_hit(self, count: int = 1) -> None:
        """Increments cache hit counter."""
        with self._lock:
            self.cache_hits += count

    def get_summary(self) -> dict[str, Any]:
        """Returns snapshot of current metrics."""
        with self._lock:
            avg_lat = (
                round(self.total_latency_ms / self.ai_calls, 2)
                if self.ai_calls > 0
                else 0.0
            )
            return {
                "ai_calls": self.ai_calls,
                "vision_calls": self.vision_calls,
                "batches": self.batches,
                "retries": self.retries,
                "cache_hits": self.cache_hits,
                "total_latency_ms": round(self.total_latency_ms, 2),
                "avg_latency_ms": avg_lat,
            }

    def validate_budget(
        self,
        question_count: Optional[int] = None,
        min_batch_size: int = 8,
        max_vision_quota: int = 2,
        total_questions: Optional[int] = None,
        batch_size: Optional[int] = None,
    ) -> tuple[bool, str]:
        """
        Validates that total AI calls did not scale linearly with individual questions.
        Formula: max_calls = ceil(N / min_batch_size) [recon] + ceil(N / 12) [solve] + max_vision_quota + 2 [planning/margin].
        """
        q_count = question_count if question_count is not None else (total_questions or 0)
        b_size = batch_size if batch_size is not None else min_batch_size

        with self._lock:
            if q_count <= 0:
                return True, "No questions to validate"

            recon_budget = math.ceil(q_count / b_size)
            solve_budget = math.ceil(q_count / 12)
            max_allowed = recon_budget + solve_budget + max_vision_quota + 2

            if self.ai_calls > max_allowed:
                return False, (
                    f"AI call budget exceeded! Max allowed for {question_count} questions is "
                    f"{max_allowed} calls (bounded O(N/B)), but observed {self.ai_calls} calls "
                    f"(detected potential O(N) linear explosion)."
                )

            if self.vision_calls > max_vision_quota:
                return False, (
                    f"Vision quota exceeded! Max allowed vision calls is {max_vision_quota}, "
                    f"but observed {self.vision_calls} calls."
                )

            return True, "AI call budget validated successfully"

    def reset(self) -> None:
        """Resets all metric counters."""
        with self._lock:
            self.ai_calls = 0
            self.vision_calls = 0
            self.batches = 0
            self.retries = 0
            self.total_latency_ms = 0.0
            self.call_history.clear()
