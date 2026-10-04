"""
Answer and Solution Engine Models (Pydantic v2)
Structured models for AI-generated answers, pedagogical explanations, and batch solutions.
"""

from typing import Optional
from pydantic import BaseModel, Field


class QuestionAnswerItem(BaseModel):
    """Answer resolution and pedagogical evidence for a single question."""
    question_id: str
    question_number: int
    type: str = "part_i_mcq"            # "part_i_mcq" | "part_ii_tf" | "part_iii_short"
    selected_answer: str = ""           # "A", "B", "C", "D" (Part I)
    sub_answers: Optional[dict[str, bool]] = None # {"a": True, "b": False...} (Part II)
    short_answer_value: Optional[str] = None      # Exact numeric or term value (Part III)
    evidence: str = ""                  # Concise pedagogical proof (NO Chain-of-Thought)
    confidence: float = 1.0


class BatchAnswerPayload(BaseModel):
    """Input payload sent to AI provider containing a batch of questions to solve."""
    batch_id: str
    questions: list[dict] = Field(default_factory=list)


class BatchAnswerResult(BaseModel):
    """Structured response schema returned by AI Provider for batch answering."""
    batch_id: str
    answers: list[QuestionAnswerItem] = Field(default_factory=list)
