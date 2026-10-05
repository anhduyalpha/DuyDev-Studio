"""
Quiz Pipeline CLI Entry Point.
Provides a standalone CLI gateway connecting Node.js worker/backend to QuizPipelineOrchestrator.
Streams realtime JSON progress events to stdout for telemetry tracking.
"""

import argparse
import json
import os
import sys

# Ensure repository root is on Python sys.path
_repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

import pymupdf

from engines.quiz.orchestrator.pipeline import QuizPipelineOrchestrator
from engines.quiz.orchestrator.state import JobStage
from engines.quiz.provider.agnes import AgnesAIProvider
from engines.quiz.provider.base import ProviderConfig
from engines.quiz.provider.mock import MockAIProvider


def emit_json_event(payload: dict) -> None:
    """Emits newline-delimited JSON payload to stdout and flushes."""
    try:
        sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    except Exception:
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Quiz Pipeline v3.0 CLI Gateway")
    parser.add_argument("pdf_path", help="Path to source PDF file")
    parser.add_argument("--instruction", default="", help="Natural language user instruction")
    parser.add_argument("--pages", default="", help="Page range to extract (e.g. 11 or 11-15)")
    parser.add_argument("--count", type=int, default=20, help="Number of questions to extract")
    parser.add_argument("--start-num", "--start", dest="start_num", type=int, default=1, help="Starting question number")
    parser.add_argument("--title", default="BÀI TẬP TRẮC NGHIỆM", help="Exam header title")
    parser.add_argument("--subtitle", default="", help="Exam subtitle")
    parser.add_argument("--duration", default="", help="Optional exam duration (e.g. '45 phút')")
    parser.add_argument("--prefix", default="DeThi", help="Output filename prefix")
    parser.add_argument("--style", default="blue_black_classic", help="Style preset ID")
    parser.add_argument("--output-dir", required=True, help="Directory to store generated artifacts")
    parser.add_argument("--job-id", default=None, help="Optional job identifier")
    parser.add_argument("--api-key", default=None, help="Agnes API Key")
    parser.add_argument("--base-url", default=None, help="Agnes Base URL")
    parser.add_argument("--model", default=None, help="Agnes Model")
    parser.add_argument("--mock", action="store_true", help="Run with MockAIProvider")

    args = parser.parse_args()

    # 1. Resolve AI Provider
    is_mock = args.mock or os.getenv("MOCK_QUIZ_AI") == "1"
    if is_mock:
        provider = MockAIProvider()
    else:
        api_key = args.api_key or os.getenv("AGNES_AI_API_KEY") or os.getenv("AGNES_API_KEY") or ""
        base_url = os.getenv("AGNES_AI_BASE_URL", "https://apihub.agnes-ai.com/v1")
        model = os.getenv("AGNES_AI_MODEL", "agnes-3.0-flash")
        config = ProviderConfig(
            api_key=api_key,
            base_url=base_url,
            model=model,
            timeout_seconds=90,
            max_retries=3,
        )
        provider = AgnesAIProvider(config)

    # 2. Build User Instruction
    instruction = args.instruction.strip()
    if not instruction:
        if args.pages:
            instruction = f"Trang {args.pages} lấy {args.count} câu từ câu {args.start_num}"
        else:
            instruction = f"Lấy {args.count} câu từ câu {args.start_num}"

    # 3. Setup Orchestrator & Progress Callback
    def on_progress(stage: JobStage, pct: int, msg: str) -> None:
        emit_json_event({
            "progress": pct,
            "stage": msg,
            "stage_name": stage.value,
        })

    orchestrator = QuizPipelineOrchestrator(
        provider=provider,
        style_preset_id=args.style,
        max_repair_iterations=2,
    )

    emit_json_event({"progress": 0, "stage": "Bắt đầu khởi động pipeline xử lý"})

    state = orchestrator.run(
        pdf_path=args.pdf_path,
        user_instruction=instruction,
        output_dir=args.output_dir,
        prefix=args.prefix,
        job_id=args.job_id,
        title=args.title,
        subtitle=args.subtitle,
        duration=args.duration,
        on_progress=on_progress,
    )

    if state.current_stage == JobStage.COMPLETED:
        debai_pdf = state.artifacts.get("debai_pdf", "")
        dapan_pdf = state.artifacts.get("dapan_pdf", "")

        ws_pages = 1
        if os.path.isfile(debai_pdf):
            try:
                doc_de = pymupdf.open(debai_pdf)
                ws_pages = doc_de.page_count
                doc_de.close()
            except Exception:
                pass

        ans_pages = 1
        if os.path.isfile(dapan_pdf):
            try:
                doc_da = pymupdf.open(dapan_pdf)
                ans_pages = doc_da.page_count
                doc_da.close()
            except Exception:
                pass

        # Count image crops if created
        crops_dir = os.path.join(args.output_dir, "crops")
        img_count = 0
        if os.path.isdir(crops_dir):
            img_count = len([f for f in os.listdir(crops_dir) if f.endswith(".png")])

        actual_questions_count = state.artifacts.get("questions_count", args.count)

        final_payload = {
            "success": True,
            "worksheet_pdf": debai_pdf,
            "answer_pdf": dapan_pdf,
            "worksheet_pages": ws_pages,
            "answer_pages": ans_pages,
            "questions_count": actual_questions_count,
            "extracted_images_count": img_count,
            "question_types": {
                "mcq": actual_questions_count,
                "true_false": 0,
                "short_answer": 0,
            },
            "metrics": {
                "total_latency_ms": state.artifacts.get("total_latency_ms", 0),
                "render_time_ms": state.artifacts.get("render_time_ms", 0),
                "ai_calls": state.artifacts.get("ai_calls", 0),
                "vision_calls": state.artifacts.get("vision_calls", 0),
                "batches": state.artifacts.get("batches", 0),
                "retries": state.artifacts.get("retries", 0),
            },
        }
        emit_json_event(final_payload)
        sys.exit(0)
    else:
        err_msg = state.error or "Tạo bài tập thất bại trong quá trình xử lý."
        err_code = state.artifacts.get("error_code", "INTERNAL_ERROR")
        diag_layer = state.artifacts.get("diagnostic_layer", "UNKNOWN")
        err_payload = {
            "success": False,
            "error_code": err_code,
            "diagnostic_layer": diag_layer,
            "message": err_msg,
        }
        sys.stderr.write(json.dumps(err_payload, ensure_ascii=False) + "\n")
        sys.stderr.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()
