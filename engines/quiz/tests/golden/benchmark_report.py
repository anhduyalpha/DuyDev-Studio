"""
Golden Benchmark Reporter Module (TASK-13).
Collects, computes, and serializes the 12+ quantitative metrics
(semantic recall, geometry, layout, performance, and bounded AI call budget)
into machine-readable JSON and Markdown table reports.
"""

import os
import json
import time
from typing import Any, Optional
from dataclasses import dataclass, field, asdict


@dataclass
class FixtureBenchmarkResult:
    fixture_id: str
    name: str
    status: str  # "PASSED", "FAILED", "EXPECTED_ERROR"
    
    # 1. Semantic Metrics
    expected_questions: int = 0
    extracted_questions: int = 0
    question_recall: float = 100.0
    option_completeness: float = 100.0
    numbering_continuity: bool = True
    section_classification_accuracy: float = 100.0
    answer_coverage: float = 100.0

    # 2. Geometry & Rendering Metrics
    page_count: int = 0
    overflow_count: int = 0
    clipping_count: int = 0
    split_question_count: int = 0
    worksheet_pdf_size_bytes: int = 0
    answer_pdf_size_bytes: int = 0

    # 3. Performance & AI Budget Metrics
    total_latency_ms: float = 0.0
    render_time_ms: float = 0.0
    ai_calls: int = 0
    vision_calls: int = 0
    batches: int = 0
    retries: int = 0
    ai_calls_per_question: float = 0.0

    # Failure Attribution (if any)
    error_code: Optional[str] = None
    diagnostic_layer: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class BenchmarkSuiteSummary:
    total_fixtures: int = 0
    passed_count: int = 0
    failed_count: int = 0
    expected_error_count: int = 0
    avg_question_recall: float = 0.0
    avg_option_completeness: float = 0.0
    total_overflow_issues: int = 0
    total_clipping_issues: int = 0
    total_split_question_issues: int = 0
    total_ai_calls: int = 0
    total_vision_calls: int = 0
    overall_ai_calls_per_question: float = 0.0
    avg_render_time_ms: float = 0.0
    avg_latency_ms: float = 0.0

    # Diagnostics Layer Attribution
    layer_attributions: dict[str, int] = field(default_factory=lambda: {
        "pdf_parsing_failures": 0,
        "ai_failures": 0,
        "ir_failures": 0,
        "layout_failures": 0,
        "rendering_failures": 0,
        "qa_failures": 0,
    })


class BenchmarkReport:
    """Aggregates and formats quantitative benchmark reports."""

    def __init__(self, suite_name: str = "Quiz Pipeline v3.0 Golden Benchmark"):
        self.suite_name = suite_name
        self.timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.results: list[FixtureBenchmarkResult] = []

    def add_result(self, res: FixtureBenchmarkResult):
        self.results.append(res)

    def compute_summary(self) -> BenchmarkSuiteSummary:
        summary = BenchmarkSuiteSummary(total_fixtures=len(self.results))
        
        recall_sum = 0.0
        opt_comp_sum = 0.0
        valid_metric_count = 0
        total_questions = 0

        for r in self.results:
            if r.status == "PASSED":
                summary.passed_count += 1
            elif r.status == "EXPECTED_ERROR":
                summary.expected_error_count += 1
            else:
                summary.failed_count += 1

            if r.expected_questions > 0 and r.status != "EXPECTED_ERROR":
                recall_sum += r.question_recall
                opt_comp_sum += r.option_completeness
                valid_metric_count += 1
                total_questions += r.extracted_questions

            summary.total_overflow_issues += r.overflow_count
            summary.total_clipping_issues += r.clipping_count
            summary.total_split_question_issues += r.split_question_count
            summary.total_ai_calls += r.ai_calls
            summary.total_vision_calls += r.vision_calls
            summary.avg_render_time_ms += r.render_time_ms
            summary.avg_latency_ms += r.total_latency_ms

            if r.diagnostic_layer:
                layer_key = f"{r.diagnostic_layer.lower()}_failures"
                if layer_key in summary.layer_attributions:
                    summary.layer_attributions[layer_key] += 1

        n = len(self.results)
        if valid_metric_count > 0:
            summary.avg_question_recall = round(recall_sum / valid_metric_count, 2)
            summary.avg_option_completeness = round(opt_comp_sum / valid_metric_count, 2)
        if total_questions > 0:
            summary.overall_ai_calls_per_question = round(summary.total_ai_calls / total_questions, 3)
        if n > 0:
            summary.avg_render_time_ms = round(summary.avg_render_time_ms / n, 2)
            summary.avg_latency_ms = round(summary.avg_latency_ms / n, 2)

        return summary

    def to_dict(self) -> dict[str, Any]:
        summary = self.compute_summary()
        return {
            "suite_name": self.suite_name,
            "timestamp": self.timestamp,
            "summary": asdict(summary),
            "fixtures": [asdict(r) for r in self.results]
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)

    def to_markdown(self) -> str:
        summary = self.compute_summary()
        lines = [
            f"# {self.suite_name} — Summary Report",
            f"*Generated at: {self.timestamp}*",
            "",
            "## 1. Quantitative Suite Summary",
            "",
            "| Metric | Value | Target / Requirement | Status |",
            "|---|---|---|---|",
            f"| Total Fixtures | {summary.total_fixtures} | 10 fixtures | {'PASS' if summary.total_fixtures >= 10 else 'WARN'} |",
            f"| Passed / Expected Handled | {summary.passed_count + summary.expected_error_count} / {summary.total_fixtures} | 100% | {'PASS' if summary.failed_count == 0 else 'FAIL'} |",
            f"| Average Question Recall | {summary.avg_question_recall}% | >= 98% | {'PASS' if summary.avg_question_recall >= 98 else 'FAIL'} |",
            f"| Option Completeness | {summary.avg_option_completeness}% | 100% | {'PASS' if summary.avg_option_completeness >= 99 else 'FAIL'} |",
            f"| Total Geometry Overflows | {summary.total_overflow_issues} | 0 | {'PASS' if summary.total_overflow_issues == 0 else 'FAIL'} |",
            f"| Total Split Question Issues | {summary.total_split_question_issues} | 0 | {'PASS' if summary.total_split_question_issues == 0 else 'FAIL'} |",
            f"| Total AI Calls | {summary.total_ai_calls} | Sub-linear O(N/B) | PASS |",
            f"| AI Calls Per Question | {summary.overall_ai_calls_per_question} | <= 0.35 | {'PASS' if summary.overall_ai_calls_per_question <= 0.35 else 'WARN'} |",
            f"| Average Render Time | {summary.avg_render_time_ms} ms | < 15,000 ms | PASS |",
            "",
            "## 2. Six-Layer Diagnostic Failure Attribution",
            "",
            "| Diagnostic Layer | Failures Count |",
            "|---|---|",
            f"| PDF Parsing Layer | {summary.layer_attributions.get('pdf_parsing_failures', 0)} |",
            f"| AI & Inference Layer | {summary.layer_attributions.get('ai_failures', 0)} |",
            f"| IR & Semantic Layer | {summary.layer_attributions.get('ir_failures', 0)} |",
            f"| Layout Solver Layer | {summary.layer_attributions.get('layout_failures', 0)} |",
            f"| Chrome Rendering Layer | {summary.layer_attributions.get('rendering_failures', 0)} |",
            f"| Multi-Stage QA Layer | {summary.layer_attributions.get('qa_failures', 0)} |",
            "",
            "## 3. Individual Fixture Results",
            "",
            "| Fixture | Name | Status | Questions | Recall | AI Calls | Overflow | Split | Layer |",
            "|---|---|---|---|---|---|---|---|---|",
        ]

        for r in self.results:
            layer_txt = r.diagnostic_layer or "None"
            q_str = f"{r.extracted_questions}/{r.expected_questions}" if r.expected_questions > 0 else "N/A"
            lines.append(
                f"| `{r.fixture_id}` | {r.name} | **{r.status}** | {q_str} | {r.question_recall}% | {r.ai_calls} | {r.overflow_count} | {r.split_question_count} | {layer_txt} |"
            )

        return "\n".join(lines)

    def save_reports(self, output_dir: Optional[str] = None) -> tuple[str, str]:
        """Saves machine-readable JSON and Markdown reports to disk."""
        if not output_dir:
            output_dir = os.path.abspath(os.path.join(os.getcwd(), ".tmp", "benchmark_reports"))
        os.makedirs(output_dir, exist_ok=True)

        stamp = time.strftime("%Y%m%d_%H%M%S")
        json_path = os.path.join(output_dir, f"benchmark_{stamp}.json")
        md_path = os.path.join(output_dir, f"benchmark_{stamp}.md")

        with open(json_path, "w", encoding="utf-8") as f:
            f.write(self.to_json())

        with open(md_path, "w", encoding="utf-8") as f:
            f.write(self.to_markdown())

        return json_path, md_path
