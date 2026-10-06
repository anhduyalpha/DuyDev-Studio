"""
Formula Verification Caching Layer (Section 15).
Caches deterministic and vision verification outcomes to avoid redundant calls:
Key: SHA-256 of (source_hash + formula_representation + verification_version).
"""

import hashlib
import json
from typing import Optional, Any
from .models import FormulaVerificationStatus, FormulaVerificationIssue

VERIFICATION_CACHE_VERSION = "v1.0.0"


class FormulaVerificationCache:
    """Thread-safe in-memory cache with hash keying for verified formulas."""

    def __init__(self) -> None:
        self._cache: dict[str, dict[str, Any]] = {}

    @staticmethod
    def compute_key(source_hash: str, formula_repr: str, version: str = VERIFICATION_CACHE_VERSION) -> str:
        """Derives stable deterministic key for cache lookup."""
        raw = f"{source_hash}:{formula_repr}:{version}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get(self, key: str) -> Optional[dict[str, Any]]:
        """Retrieves cached result if present."""
        return self._cache.get(key)

    def set(
        self,
        key: str,
        status: FormulaVerificationStatus,
        issues: list[FormulaVerificationIssue],
        repaired_text: Optional[str] = None
    ) -> None:
        """Stores verified outcome."""
        self._cache[key] = {
            "status": status.value,
            "issues": [i.model_dump() for i in issues],
            "repaired_text": repaired_text,
        }

    def clear(self) -> None:
        """Clears cache entries."""
        self._cache.clear()


# Global Singleton Cache
global_formula_cache = FormulaVerificationCache()
