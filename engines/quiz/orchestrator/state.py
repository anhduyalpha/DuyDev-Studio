"""
Finite State Machine & State Persistence for Quiz Pipeline Orchestrator.
Maintains 13 sequential states, idempotent progress updates, and atomic JSON state persistence.
"""

import os
import json
import tempfile
from enum import Enum
from typing import Optional, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class JobStage(str, Enum):
    """The formal execution stages of the Quiz Processing Pipeline."""
    CREATED = "CREATED"
    INSPECTING = "INSPECTING"
    PLANNING = "PLANNING"
    RECONSTRUCTING = "RECONSTRUCTING"
    NORMALIZING = "NORMALIZING"
    SOLVING = "SOLVING"
    FORMULA_VERIFICATION = "FORMULA_VERIFICATION"
    RENDERING = "RENDERING"
    COMPILING = "COMPILING"
    QA = "QA"
    REPAIRING = "REPAIRING"
    FINALIZING = "FINALIZING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class JobState(BaseModel):
    """Encapsulates execution state, progress, and produced artifacts for a quiz job."""
    job_id: str
    current_stage: JobStage = JobStage.CREATED
    progress_pct: int = 0
    message: str = "Khởi tạo tác vụ"
    error: Optional[str] = None
    repair_iteration: int = 0
    max_repair_iterations: int = 2
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    artifacts: dict[str, Any] = Field(default_factory=dict)
    diagnostics: list[dict] = Field(default_factory=list)

    def transition_to(self, stage: JobStage, progress_pct: int, message: str) -> None:
        """Update current stage and progress."""
        self.current_stage = stage
        self.progress_pct = max(0, min(100, progress_pct))
        self.message = message
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def mark_failed(self, error_message: str) -> None:
        """Mark job as failed with specific message."""
        self.current_stage = JobStage.FAILED
        self.error = error_message
        self.message = f"Thất bại: {error_message}"
        self.updated_at = datetime.now(timezone.utc).isoformat()


class JobStateManager:
    """Provides atomic file operations for persisting and resuming JobState."""

    @staticmethod
    def save(state: JobState, state_file_path: str) -> None:
        """Atomic write to disk to prevent state corruption during crashes."""
        state.updated_at = datetime.now(timezone.utc).isoformat()
        os.makedirs(os.path.dirname(os.path.abspath(state_file_path)), exist_ok=True)

        temp_dir = os.path.dirname(os.path.abspath(state_file_path))
        with tempfile.NamedTemporaryFile("w", dir=temp_dir, delete=False, encoding="utf-8") as tf:
            json.dump(state.model_dump(), tf, indent=2, ensure_ascii=False)
            temp_name = tf.name

        os.replace(temp_name, state_file_path)

    @staticmethod
    def load(state_file_path: str) -> JobState:
        """Load JobState from JSON file."""
        if not os.path.isfile(state_file_path):
            raise FileNotFoundError(f"Job state file not found: {state_file_path}")
        with open(state_file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return JobState.model_validate(data)
