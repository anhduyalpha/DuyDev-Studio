"""
Quiz Pipeline Orchestrator.
Orchestrates the entire lifecycle: Ingestion -> Perception -> Planning -> Reconstruction
-> Normalization -> Solving -> Rendering -> Compiling -> QA -> Safe Repair -> Finalization.
Enforces atomic state persistence and strict Final Gate validation.
"""

import os
import re
import time
import uuid
from typing import Callable, Any
from datetime import datetime, timezone
import pymupdf

from engines.quiz.common.errors import ErrorCode, DiagnosticLayer, QuizEngineError
from engines.quiz.quiz_cache import get_perception_cache, set_perception_cache
from engines.quiz.perception.models import PageRepresentation, PageKind
from engines.quiz.perception.extractor import extract_document_representations
from engines.quiz.recognition.range_resolver import resolve_smart_range
from engines.quiz.recognition.rule_parser import parse_numeric_instruction
from engines.quiz.recognition.question_index import QuestionIndexService
from engines.quiz.reconstruction.batch_planner import BatchPlanner
from engines.quiz.reconstruction.reconstructor import QuestionReconstructor
from engines.quiz.reconstruction.post_processor import post_process_questions
from engines.quiz.assets.extractor import RichAssetExtractor
from engines.quiz.graph.object_graph import DocumentObjectGraph
from engines.quiz.ir.builder import CanonicalIRBuilder
from engines.quiz.ir.models import DocumentMetadataIR
from engines.quiz.solver.solver import AnswerSolver
from engines.quiz.rendering.styles import style_registry, StylePreset
from engines.quiz.rendering.compiler import PDFCompiler, sanitize_filename_prefix
from engines.quiz.qa.geometry_qa import validate_pdf_geometry
from engines.quiz.qa.semantic_qa import validate_semantic_integrity
from engines.quiz.qa.vision_qa import run_selective_vision_qa
from engines.quiz.qa.repair import SafeRepairEngine
from engines.quiz.qa.final_validator import validate_final_pdf
from engines.quiz.qa.models import OverallQAResult, QAIssueType, QASeverity
from engines.quiz.orchestrator.state import JobStage, JobState, JobStateManager
from engines.quiz.formula_verification.gate import FormulaVerificationGate


class QuizPipelineOrchestrator:
    """End-to-End Orchestrator executing the complete background quiz pipeline."""

    def __init__(
        self,
        provider: Any = None,
        style_preset_id: str = "blue_black_classic",
        max_repair_iterations: int = 2,
    ) -> None:
        self.provider = provider
        self.style_preset = style_registry.get(style_preset_id)
        self.max_repair_iterations = max_repair_iterations

    def run(
        self,
        pdf_path: str,
        user_instruction: str,
        output_dir: str,
        prefix: str = "DeThi",
        job_id: str | None = None,
        title: str | None = None,
        subtitle: str | None = None,
        duration: str | None = None,
        on_progress: Callable[[JobStage, int, str], None] | None = None,
    ) -> JobState:
        """Execute the end-to-end pipeline with state machine transitions."""
        os.makedirs(output_dir, exist_ok=True)
        active_job_id = job_id or f"job_{uuid.uuid4().hex[:12]}"
        state_file = os.path.join(output_dir, "job_state.json")

        state = JobState(
            job_id=active_job_id,
            current_stage=JobStage.CREATED,
            progress_pct=0,
            message="🌱 Đang chuẩn bị không gian làm việc xinh xắn để soạn bài... ✨",
            max_repair_iterations=self.max_repair_iterations,
        )

        def emit(stage: JobStage, pct: int, msg: str) -> None:
            state.transition_to(stage, pct, msg)
            JobStateManager.save(state, state_file)
            if on_progress:
                try:
                    on_progress(stage, pct, msg)
                except Exception:
                    pass

        emit(JobStage.CREATED, 0, "🚀 Đang khởi động cỗ máy biên soạn đề thi siêu xịn sò... ✨")
        start_total_time = time.perf_counter()
        render_time_ms = 0.0

        try:
            # 1. PERCEPTION (0% - 15%)
            emit(JobStage.INSPECTING, 10, "🔍 Đang lật giở từng trang PDF và ngắm nghía câu chữ nè... 📖")
            
            # Check Layer 1 Perception Cache
            cached_pages = get_perception_cache(pdf_path, user_instruction)
            if cached_pages:
                page_representations = [PageRepresentation(**p) for p in cached_pages]
            else:
                page_representations = extract_document_representations(pdf_path)
                if page_representations:
                    set_perception_cache(
                        pdf_path,
                        user_instruction,
                        [p.model_dump() for p in page_representations]
                    )

            if not page_representations:
                raise QuizEngineError(
                    ErrorCode.PDF_INVALID,
                    DiagnosticLayer.PDF_PARSING_FAILURE,
                    "Không thể bóc tách nội dung từ tệp PDF nguồn.",
                    stage=JobStage.INSPECTING.value
                )

            # Check if pure scanned document without OCR text layer
            total_text = "".join(p.raw_text for p in page_representations).strip()
            all_scanned = all(p.page_kind in (PageKind.SCANNED, "scanned") for p in page_representations)
            if all_scanned and len(total_text) < 30:
                raise QuizEngineError(
                    ErrorCode.PDF_SCAN_TOO_LOW_QUALITY,
                    DiagnosticLayer.PDF_PARSING_FAILURE,
                    "Tài liệu dạng ảnh quét thuần túy không có lớp chữ số. Vui lòng chọn tài liệu rõ nét hơn.",
                    stage=JobStage.INSPECTING.value
                )

            # 2. PLANNING (15% - 30%)
            emit(JobStage.PLANNING, 20, "🧭 Đang lên kế hoạch chi tiết cho các câu hỏi bạn yêu thích... 📑")
            smart_res = resolve_smart_range(
                instruction=user_instruction,
                doc_reps=page_representations,
                ai_provider=self.provider,
            )
            start_page = smart_res.start_page
            end_page = smart_res.end_page
            effective_count = smart_res.question_count
            start_num = smart_res.start_question
            end_num = start_num + effective_count - 1

            # PLAN-05: Page Neighborhood Scanner & Question Index Validation (HARD GATE)
            emit(JobStage.PLANNING, 25, "📋 Đang sắp xếp danh mục câu hỏi thật ngăn nắp và chỉn chu... 🌸")
            index_service = QuestionIndexService(ai_provider=self.provider)
            target_range_pages = list(range(start_page, end_page + 1))
            neighborhood = index_service.build_multi_page_neighborhood_index(
                target_pages=target_range_pages,
                doc_reps=page_representations
            )

            # Reconcile question bounds from numeric instruction if explicitly provided
            parsed_instr = parse_numeric_instruction(user_instruction)
            if parsed_instr and parsed_instr.start_question is not None:
                plan_start_q = parsed_instr.start_question
                plan_end_q = parsed_instr.end_question or (plan_start_q + (parsed_instr.question_count or effective_count) - 1)
                plan_count = parsed_instr.question_count or (plan_end_q - plan_start_q + 1)
            else:
                plan_start_q = start_num
                plan_end_q = end_num
                plan_count = effective_count

            extraction_plan = index_service.build_extraction_plan(
                neighborhood=neighborhood,
                start_q=plan_start_q,
                end_q=plan_end_q,
                count=plan_count,
                doc_reps=page_representations,
                ai_provider=self.provider,
                raise_on_mismatch=True
            )

            # Align effective count and start_num with validated extraction plan
            start_num = extraction_plan.requested_start_question
            effective_count = extraction_plan.requested_count
            target_pages_all = list(set(extraction_plan.target_pages + extraction_plan.continuation_pages))
            if target_pages_all:
                start_page = min(target_pages_all)
                end_page = max(target_pages_all)

            pages_in_range = [
                p for p in page_representations if start_page <= p.page_number <= end_page
            ]
            if not pages_in_range:
                pages_in_range = page_representations

            # Extract rich visual assets & construct Document Object Graph (PLAN-01)
            assets_dir = os.path.join(output_dir, "assets")
            rich_extractor = RichAssetExtractor(output_dir=assets_dir)
            fitz_doc_assets = pymupdf.open(pdf_path)
            try:
                target_pages = [p.page_number for p in pages_in_range]
                extracted_assets = rich_extractor.extract_all(fitz_doc_assets, page_numbers=target_pages)
            finally:
                fitz_doc_assets.close()

            doc_graph = DocumentObjectGraph.build(
                doc_reps=pages_in_range,
                asset_records=extracted_assets
            )

            batches = BatchPlanner.plan_batches(
                doc_reps=pages_in_range,
                start_page=start_page,
                end_page=end_page,
                start_question=start_num,
                question_count=effective_count,
                target_question_numbers=extraction_plan.target_question_numbers,
            )

            # 3. RECONSTRUCTING (30% - 50%)
            emit(JobStage.RECONSTRUCTING, 35, f"✍️ Đang cặm cụi nắn nót từng câu hỏi qua {len(batches)} đợt xử lý siêu tốc... 📝")
            reconstructor = QuestionReconstructor(ai_provider=self.provider)
            raw_questions = reconstructor.reconstruct_all(batches)

            emit(JobStage.RECONSTRUCTING, 45, "🎨 Đang tỉ mẩn gọt giũa hình vẽ và ghép đúng câu hỏi nè... 🖼️")
            full_source_text = "\n\n".join(p.raw_text for p in page_representations)
            cleaned_questions = post_process_questions(
                raw_questions,
                start_question=start_num,
                expected_count=effective_count,
                source_context=full_source_text,
                target_question_numbers=extraction_plan.target_question_numbers,
            )

            # PLAN-05 HARD GATE: Verify reconstructed questions against extraction plan
            if extraction_plan and extraction_plan.target_question_numbers:
                expected_nums = set(extraction_plan.target_question_numbers)
                actual_nums = {q.source_number or q.number for q in cleaned_questions}
                missing_nums = sorted(list(expected_nums - actual_nums))
                if missing_nums:
                    raise QuizEngineError(
                        ErrorCode.RANGE_MISMATCH,
                        DiagnosticLayer.RECONSTRUCTION_FAILURE,
                        f"Không tìm thấy đủ câu hỏi yêu cầu trong tài liệu (thiếu {len(missing_nums)} câu: {missing_nums[:5]}). "
                        f"Tuyệt đối không xuất bản đề thi thiếu câu hỏi.",
                        stage=JobStage.RECONSTRUCTING.value,
                        details={
                            "expected_count": len(extraction_plan.target_question_numbers),
                            "actual_count": len(cleaned_questions),
                            "missing_questions": missing_nums
                        }
                    )

            # Associate visual assets from Document Object Graph
            attachments_map = doc_graph.associate_assets_to_questions(
                questions=cleaned_questions,
                ai_provider=self.provider
            )

            # 4. SOLVING (50% - 62%)
            emit(JobStage.SOLVING, 55, "🧠 Đang vắt óc suy nghĩ để viết lời giải chi tiết siêu dễ hiểu... 💡")
            solver = AnswerSolver(ai_provider=self.provider)
            answer_keys = solver.solve_all(cleaned_questions)

            # 5. NORMALIZING & IR PACKAGING (62% - 70%)
            emit(JobStage.NORMALIZING, 65, "🧪 Đang trau chuốt các công thức Toán - Hóa lung linh chuẩn quốc tế... 🔬")
            crops_dir = os.path.join(output_dir, "crops")
            os.makedirs(crops_dir, exist_ok=True)

            doc_title = title.strip() if (title and title.strip()) else (f"BÀI TẬP TRẮC NGHIỆM - {prefix}" if prefix else "BÀI TẬP TRẮC NGHIỆM")
            clean_duration = duration.strip() if (duration and duration.strip()) else None
            metadata = DocumentMetadataIR(
                title=doc_title,
                subject="HÓA HỌC",
                total_questions=len(cleaned_questions),
                duration=clean_duration,
                source_filename=os.path.basename(pdf_path),
                created_at=datetime.now(timezone.utc).isoformat(),
            )

            fitz_doc = pymupdf.open(pdf_path)
            try:
                doc_ir = CanonicalIRBuilder.build(
                    reconstructed_questions=cleaned_questions,
                    doc_reps=pages_in_range,
                    answers=answer_keys,
                    metadata=metadata,
                    pdf_doc=fitz_doc,
                    crops_output_dir=crops_dir,
                    rich_element_attachments=attachments_map,
                )
            finally:
                fitz_doc.close()

            # 5b. FORMULA INTEGRITY VERIFICATION GATE (68% - 70%)
            emit(JobStage.FORMULA_VERIFICATION, 68, "🛡️ Đang soi kính lúp kiểm tra từng dấu và chỉ số công thức cho chuẩn chỉnh... 🔍")
            formula_gate_res = FormulaVerificationGate.verify_and_repair(
                doc_ir=doc_ir,
                pdf_path=pdf_path,
                ai_provider=self.provider,
                output_dir=output_dir,
                max_retries=self.max_repair_iterations,
            )

            if not formula_gate_res.is_pass():
                raise QuizEngineError(
                    ErrorCode.FORMULA_VERIFY_FAILED,
                    DiagnosticLayer.FORMULA_FAILURE,
                    f"Kiểm định công thức thất bại: {formula_gate_res.summary()}",
                    stage=JobStage.FORMULA_VERIFICATION.value,
                    details=formula_gate_res.to_dict(),
                )

            # 6. RENDERING, COMPILING & QA LOOP (70% - 95%)
            clean_prefix = sanitize_filename_prefix(prefix)
            compiler = PDFCompiler()
            current_preset = self.style_preset
            iteration = 0
            debai_pdf_path = ""
            dapan_pdf_path = ""
            force_break_ids: set[str] = set()

            while iteration <= self.max_repair_iterations:
                emit(
                    JobStage.RENDERING,
                    72 + iteration * 6,
                    f"📐 Đang xếp chữ và dàn trang A4 siêu ngay ngắn, chuẩn mực in ấn... 📄 (Lần {iteration + 1})",
                )
                emit(
                    JobStage.COMPILING,
                    78 + iteration * 6,
                    f"🖨️ Máy in tí hon đang rục rịch xuất bản 2 bản PDF lung linh... 📑 (Lần {iteration + 1})",
                )

                compile_start = time.perf_counter()
                debai_pdf_path, dapan_pdf_path = compiler.compile_both(
                    doc_ir=doc_ir,
                    output_dir=output_dir,
                    prefix=clean_prefix,
                    preset=current_preset,
                    force_break_ids=force_break_ids,
                )
                render_time_ms += (time.perf_counter() - compile_start) * 1000

                # QA Stage
                emit(JobStage.QA, 85 + iteration * 3, f"✨ Đang soi lại từng trang để bộ đề đạt điểm 10 chất lượng... 🔎 (Lần {iteration + 1})")
                geom_result = validate_pdf_geometry(debai_pdf_path, doc_ir=doc_ir)
                sem_result = validate_semantic_integrity(doc_ir, debai_pdf_path, dapan_pdf_path)
                final_qa = validate_final_pdf(debai_pdf_path, doc_ir=doc_ir, dapan_pdf_path=dapan_pdf_path)

                flagged_pages = [i.page for i in geom_result.issues if i.page > 0]
                rich_pages = sorted({
                    elem.page_number
                    for q in doc_ir.questions
                    for elem in getattr(q, "rich_elements", [])
                    if getattr(elem, "page_number", 0) > 0
                })
                vis_result = run_selective_vision_qa(
                    pdf_path=debai_pdf_path,
                    flagged_pages=flagged_pages,
                    rich_element_pages=rich_pages,
                    provider=self.provider,
                )

                # Post-render formula spot-check (Section 11)
                post_formula_res = FormulaVerificationGate.verify_post_render(
                    pdf_path=debai_pdf_path,
                    doc_ir=doc_ir,
                    gate_result=formula_gate_res,
                )

                qa_passed = geom_result.is_pass() and sem_result.is_pass() and vis_result.is_pass() and final_qa.is_pass() and post_formula_res.is_pass()
                overall_qa = OverallQAResult(
                    status="PASS" if qa_passed else "FAIL",
                    geometry=geom_result,
                    semantic=sem_result,
                    vision=vis_result,
                    requires_repair=not qa_passed,
                )

                state.diagnostics.append(
                    {
                        "iteration": iteration,
                        "overall_status": overall_qa.status,
                        "geometry_issues": len(geom_result.issues),
                        "semantic_issues": len(sem_result.issues),
                        "final_qa_issues": len(final_qa.issues),
                        "formula_issues": len(post_formula_res.issues),
                    }
                )

                # Check if QA passes
                if overall_qa.is_pass():
                    break

                # Extract split question IDs to force atomic page breaks on retry
                for issue in (geom_result.issues + final_qa.issues):
                    if issue.type == QAIssueType.SPLIT_QUESTION:
                        m_qid = re.search(r"qid=([a-zA-Z0-9_\-]+)", issue.description)
                        if m_qid:
                            force_break_ids.add(m_qid.group(1))
                        else:
                            m_num = re.search(r"Question\s+(\d+)", issue.description)
                            if m_num:
                                q_num = int(m_num.group(1))
                                for q in doc_ir.questions:
                                    if q.number == q_num:
                                        force_break_ids.add(q.id)

                # Attempt Safe Repair
                if iteration < self.max_repair_iterations:
                    emit(
                        JobStage.REPAIRING,
                        88 + iteration * 3,
                        f"🩹 Đang nhẹ nhàng căn chỉnh lại bố cục cho thật hoàn hảo... 🌷 (Lần {iteration + 1})",
                    )
                    doc_ir, current_preset, was_repaired = SafeRepairEngine.evaluate_and_repair(
                        doc_ir=doc_ir,
                        style_preset=current_preset,
                        qa_result=overall_qa,
                        current_iteration=iteration,
                        max_iterations=self.max_repair_iterations,
                    )
                    iteration += 1
                    state.repair_iteration = iteration
                    if not was_repaired:
                        break
                else:
                    break

            # 7. FINALIZING & STRICT FINAL GATE (95% - 100%)
            emit(JobStage.FINALIZING, 95, "🎁 Đang thắt nơ đóng gói bộ tài liệu thật đẹp để gửi tới bạn nè... 🎀")

            if not os.path.isfile(debai_pdf_path) or os.path.getsize(debai_pdf_path) < 1024:
                raise QuizEngineError(
                    ErrorCode.RENDER_FAILED,
                    DiagnosticLayer.RENDERING_FAILURE,
                    f"Tệp đề bài không hợp lệ hoặc thiếu: {debai_pdf_path}",
                    stage=JobStage.FINALIZING.value
                )

            if not os.path.isfile(dapan_pdf_path) or os.path.getsize(dapan_pdf_path) < 1024:
                raise QuizEngineError(
                    ErrorCode.RENDER_FAILED,
                    DiagnosticLayer.RENDERING_FAILURE,
                    f"Tệp đáp án không hợp lệ hoặc thiếu: {dapan_pdf_path}",
                    stage=JobStage.FINALIZING.value
                )

            # Strict Final Gate Execution
            gate_qa = validate_final_pdf(debai_pdf_path, doc_ir=doc_ir, dapan_pdf_path=dapan_pdf_path)
            if not gate_qa.is_pass():
                crit_issues = [
                    i.description for i in gate_qa.issues
                    if i.severity in (QASeverity.CRITICAL, QASeverity.HIGH)
                ]
                err_msg = "; ".join(crit_issues[:3]) if crit_issues else "Kiểm định chất lượng cuối cùng không đạt chuẩn."
                raise QuizEngineError(
                    ErrorCode.QA_FAILED,
                    DiagnosticLayer.QA_FAILURE,
                    f"Kiểm định chất lượng xuất bản thất bại: {err_msg}",
                    stage=JobStage.FINALIZING.value,
                    details={"issues": [i.model_dump() for i in gate_qa.issues]},
                )

            # Optional Post-Render Formula Verification
            if debai_pdf_path and os.path.isfile(debai_pdf_path):
                FormulaVerificationGate.verify_post_render(
                    pdf_path=debai_pdf_path,
                    doc_ir=doc_ir,
                    gate_result=formula_gate_res,
                )

            total_latency_ms = (time.perf_counter() - start_total_time) * 1000
            ai_summary = self.provider.tracker.get_summary() if hasattr(self.provider, "tracker") else {}

            # Validate AI Budget invariant (TASK-13)
            if hasattr(self.provider, "tracker"):
                valid_budget, budget_msg = self.provider.tracker.validate_budget(len(cleaned_questions))
                if not valid_budget:
                    state.diagnostics.append({"warning": budget_msg, "code": "AI_BUDGET_WARNING"})

            # Register artifacts
            state.diagnostics.append(
                {
                    "formula_gate_status": formula_gate_res.status,
                    "formulas_verified": formula_gate_res.verified_count,
                    "formulas_repaired": formula_gate_res.repaired_count,
                    "formulas_failed": formula_gate_res.failed_count,
                }
            )

            state.artifacts = {
                "debai_pdf": debai_pdf_path,
                "dapan_pdf": dapan_pdf_path,
                "debai_html": os.path.join(output_dir, f"{clean_prefix}_DeBai.html"),
                "dapan_html": os.path.join(output_dir, f"{clean_prefix}_DapAn.html"),
                "doc_ir": doc_ir,
                "formula_verification": formula_gate_res.to_dict(),
                "questions_count": len(cleaned_questions),
                "total_latency_ms": round(total_latency_ms, 2),
                "pipeline_ms": round(total_latency_ms, 2),
                "render_time_ms": round(render_time_ms, 2),
                "ai_calls": ai_summary.get("ai_calls", 0),
                "vision_calls": ai_summary.get("vision_calls", 0),
                "batches": max(ai_summary.get("batches", 0), len(batches)),
                "retries": ai_summary.get("retries", 0),
                "cache_hits": ai_summary.get("cache_hits", 0),
            }

            emit(JobStage.COMPLETED, 100, "🎉 Ten ten! Bộ đề bài và đáp án siêu đẹp của bạn đã sẵn sàng rồi nè! 💖")
            return state

        except Exception as exc:
            if isinstance(exc, QuizEngineError):
                q_err = exc
            else:
                from engines.quiz.provider.base import ProviderTimeoutError, ProviderRateLimitError, ProviderError
                if isinstance(exc, ProviderTimeoutError):
                    code = ErrorCode.AI_TIMEOUT
                    layer = DiagnosticLayer.AI_FAILURE
                elif isinstance(exc, ProviderRateLimitError):
                    code = ErrorCode.AI_RATE_LIMIT
                    layer = DiagnosticLayer.AI_FAILURE
                elif isinstance(exc, ProviderError):
                    code = ErrorCode.AI_INVALID_OUTPUT
                    layer = DiagnosticLayer.AI_FAILURE
                elif "PDF" in str(exc) or "compile" in str(exc).lower():
                    code = ErrorCode.RENDER_FAILED
                    layer = DiagnosticLayer.RENDERING_FAILURE
                else:
                    code = ErrorCode.PDF_INVALID
                    layer = DiagnosticLayer.PDF_PARSING_FAILURE

                q_err = QuizEngineError(
                    code=code,
                    layer=layer,
                    message=str(exc),
                    stage=state.current_stage.value
                )

            state.mark_failed(q_err.user_message)
            state.artifacts["error_code"] = q_err.code.value
            state.artifacts["diagnostic_layer"] = q_err.layer.value
            state.diagnostics.append(q_err.to_dict())
            JobStateManager.save(state, state_file)
            if on_progress:
                try:
                    on_progress(JobStage.FAILED, state.progress_pct, state.message)
                except Exception:
                    pass
            return state
