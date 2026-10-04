"""
Answer and Solution Engine Package
Batched question solving, pedagogical explanation generation, and answer key assembly.
"""

from .models import QuestionAnswerItem, BatchAnswerPayload, BatchAnswerResult
from .solver import AnswerSolver

__all__ = [
    "QuestionAnswerItem",
    "BatchAnswerPayload",
    "BatchAnswerResult",
    "AnswerSolver"
]
