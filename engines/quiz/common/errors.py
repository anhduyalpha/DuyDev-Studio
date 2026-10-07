"""
Standardized Stable Error Codes & Multi-Layer Diagnostic Taxonomy (TASK-13 & TASK-14).
Provides machine-readable error codes and root cause attribution across 6 execution layers.
"""

from enum import Enum
from typing import Optional, Any


class DiagnosticLayer(str, Enum):
    """The distinct technical layers responsible for pipeline failures."""
    PDF_PARSING_FAILURE = "PDF_PARSING_FAILURE"
    RECOGNITION_FAILURE = "RECOGNITION_FAILURE"
    RECONSTRUCTION_FAILURE = "RECONSTRUCTION_FAILURE"
    AI_FAILURE = "AI_FAILURE"
    IR_FAILURE = "IR_FAILURE"
    LAYOUT_FAILURE = "LAYOUT_FAILURE"
    RENDERING_FAILURE = "RENDERING_FAILURE"
    QA_FAILURE = "QA_FAILURE"
    FORMULA_FAILURE = "FORMULA_FAILURE"


class ErrorCode(str, Enum):
    """Standardized stable error codes for production reliability."""
    PDF_INVALID = "PDF_INVALID"
    SOURCE_FETCH_FAILED = "SOURCE_FETCH_FAILED"
    PDF_UNSUPPORTED = "PDF_UNSUPPORTED"
    PDF_SCAN_TOO_LOW_QUALITY = "PDF_SCAN_TOO_LOW_QUALITY"
    NO_QUESTIONS_FOUND = "NO_QUESTIONS_FOUND"
    RANGE_MISMATCH = "RANGE_MISMATCH"
    AI_TIMEOUT = "AI_TIMEOUT"
    AI_RATE_LIMIT = "AI_RATE_LIMIT"
    AI_INVALID_OUTPUT = "AI_INVALID_OUTPUT"
    OPTION_MISSING = "OPTION_MISSING"
    RENDER_FAILED = "RENDER_FAILED"
    QA_FAILED = "QA_FAILED"
    FORMULA_VERIFY_FAILED = "FORMULA_VERIFY_FAILED"
    FORMULA_SOURCE_CONFLICT = "FORMULA_SOURCE_CONFLICT"


ERROR_MESSAGES_VI: dict[ErrorCode, str] = {
    ErrorCode.RANGE_MISMATCH: (
        "Dải câu hỏi phát hiện không khớp với yêu cầu của người dùng. Vui lòng kiểm tra lại số trang hoặc số câu."
    ),
    ErrorCode.OPTION_MISSING: (
        "Câu hỏi trắc nghiệm bị thiếu phương án lựa chọn trong tài liệu nguồn."
    ),
    ErrorCode.PDF_INVALID: (
        "Tệp PDF bị hỏng hoặc không đúng định dạng chuẩn. Vui lòng kiểm tra lại tệp nguồn."
    ),
    ErrorCode.SOURCE_FETCH_FAILED: (
        "Không thể truy cập tài liệu nguồn. Vui lòng kiểm tra quyền chia sẻ công khai của liên kết."
    ),
    ErrorCode.PDF_UNSUPPORTED: (
        "Tệp PDF đã bị khóa mật khẩu bảo vệ. Vui lòng mở khóa tệp trước khi tải lên."
    ),
    ErrorCode.PDF_SCAN_TOO_LOW_QUALITY: (
        "Tài liệu dạng ảnh quét mờ không có lớp chữ số. Vui lòng chọn tài liệu rõ nét hơn."
    ),
    ErrorCode.NO_QUESTIONS_FOUND: (
        "Không tìm thấy câu hỏi trong phạm vi trang đã chọn. Vui lòng kiểm tra lại số trang."
    ),
    ErrorCode.AI_TIMEOUT: (
        "Máy chủ AI phản hồi quá lâu. Hệ thống đã lưu lại tiến trình, vui lòng thử lại sau giây lát."
    ),
    ErrorCode.AI_RATE_LIMIT: (
        "Hệ thống AI đang có lưu lượng truy cập cao. Vui lòng thử lại sau ít phút."
    ),
    ErrorCode.AI_INVALID_OUTPUT: (
        "Không thể cấu trúc hóa câu hỏi theo định dạng chuẩn. Đã kích hoạt chế độ sao lưu an toàn."
    ),
    ErrorCode.RENDER_FAILED: (
        "Quá trình xuất bản PDF gặp sự cố trình hiển thị. Đang tự động thử lại với cấu hình an toàn."
    ),
    ErrorCode.QA_FAILED: (
        "Đề thi không đạt tiêu chuẩn in ấn sau các bước căn chỉnh bố cục tự động."
    ),
    ErrorCode.FORMULA_VERIFY_FAILED: (
        "Công thức Toán / Hóa / Lý không bảo đảm tính toàn vẹn so với tài liệu gốc."
    ),
    ErrorCode.FORMULA_SOURCE_CONFLICT: (
        "Xung đột giữa lớp văn bản và hình ảnh gốc của công thức."
    ),
}


class QuizEngineError(Exception):
    """
    Structured domain exception carrying machine-readable error codes and layer attribution.
    Prevents unhandled crashes and provides diagnostic traceability.
    """

    def __init__(
        self,
        code: ErrorCode,
        layer: Optional[DiagnosticLayer] = None,
        message: Optional[str] = None,
        stage: str = "UNKNOWN",
        details: Optional[dict[str, Any]] = None,
        diagnostic_layer: Optional[DiagnosticLayer] = None,
    ):
        self.code = code
        self.layer = layer or diagnostic_layer or DiagnosticLayer.AI_FAILURE
        self.user_message = message or ERROR_MESSAGES_VI.get(code, "Đã xảy ra lỗi khi xử lý bài tập.")
        self.stage = stage
        self.details = details or {}
        super().__init__(f"[{code.value}] {self.user_message}")

    @property
    def diagnostic_layer(self) -> DiagnosticLayer:
        return self.layer

    @property
    def message(self) -> str:
        return self.user_message

    def to_dict(self) -> dict[str, Any]:
        """Returns structured JSON-serializable representation."""
        return {
            "error_code": self.code.value,
            "diagnostic_layer": self.layer.value,
            "message": self.user_message,
            "stage": self.stage,
            "details": self.details,
        }
