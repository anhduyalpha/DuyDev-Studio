"""
Headless Chrome PDF Compiler for Quiz Worksheets and Answer Keys.
Compiles HTML documents into publication-grade, print-ready A4 PDFs
with isolated user profile directory, timeout control, offline KaTeX bundling,
and strict PyMuPDF verification.
"""

import os
import sys
import re
import time
import shutil
import tempfile
import uuid
import subprocess
import pymupdf

from engines.quiz.ir.models import CanonicalDocumentIR
from engines.quiz.rendering.styles import StylePreset, style_registry
from engines.quiz.rendering.renderer import DocumentHTMLRenderer
from engines.quiz.rendering.layout import LayoutSolver


def sanitize_filename_prefix(prefix: str) -> str:
    """Sanitize string to be safe as a filesystem filename prefix."""
    if not prefix:
        return "DeThi"
    # Remove filesystem prohibited characters \ / : * ? " < > |
    sanitized = re.sub(r'[\\/*?:"<>|]', "", prefix)
    sanitized = sanitized.strip().replace(" ", "_")
    return sanitized or "DeThi"


def find_chrome_path() -> str:
    """Discover installed Google Chrome or Chromium executable on Windows, Linux, or macOS."""
    env_path = os.environ.get("QUIZ_CHROME_PATH")
    if env_path and os.path.isfile(env_path) and os.access(env_path, os.X_OK):
        return env_path

    search_paths: list[str] = []

    if sys.platform == "win32":
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        search_paths.extend([
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            os.path.join(local_app_data, r"Google\Chrome\Application\chrome.exe"),
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        ])
    elif sys.platform == "darwin":
        search_paths.extend([
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ])
    else:
        # Linux
        search_paths.extend([
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/snap/bin/chromium",
        ])

    for p in search_paths:
        if p and os.path.isfile(p):
            return p

    # Fallback to which/where
    try:
        binary = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chrome") or shutil.which("msedge")
        if binary:
            return binary
    except Exception:
        pass

    raise RuntimeError(
        "Google Chrome or Chromium binary not found on this system. "
        "Please install Google Chrome or set QUIZ_CHROME_PATH environment variable."
    )


def _terminate_proc_safely(proc: subprocess.Popen) -> None:
    """Terminate subprocess and its children safely without leaving zombie processes."""
    try:
        if sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5.0,
            )
        else:
            proc.terminate()
            try:
                proc.wait(timeout=3.0)
            except subprocess.TimeoutExpired:
                proc.kill()
    except Exception:
        pass
    finally:
        try:
            if proc.stdout:
                proc.stdout.close()
            if proc.stderr:
                proc.stderr.close()
            proc.wait(timeout=0.5)
        except Exception:
            pass


def compile_html_to_pdf(chrome_path: str, html_path: str, pdf_path: str, timeout: float = 45.0) -> None:
    """
    Compile an HTML file to PDF via Headless Chrome with isolated profile,
    anti-hang timeout guard, and verification.
    """
    abs_html = os.path.abspath(html_path)
    abs_pdf = os.path.abspath(pdf_path)

    os.makedirs(os.path.dirname(abs_pdf), exist_ok=True)
    if os.path.exists(abs_pdf):
        try:
            os.remove(abs_pdf)
        except Exception:
            pass

    temp_profile = os.path.join(tempfile.gettempdir(), f"chrome_pdf_{os.getpid()}_{uuid.uuid4().hex[:8]}")
    os.makedirs(temp_profile, exist_ok=True)

    file_url = f"file:///{abs_html.replace(os.sep, '/')}" if sys.platform == "win32" else f"file://{abs_html}"

    def run_chrome_worker(headless_flag: str) -> bool:
        cmd = [
            chrome_path,
            headless_flag,
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-crash-reporter",
            "--disable-breakpad",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--disable-extensions",
            "--disable-default-apps",
            "--disable-sync",
            "--mute-audio",
            "--allow-file-access-from-files",
            "--run-all-compositor-stages-before-draw",
            "--virtual-time-budget=8000",
            "--disable-features=NetworkService",
            f"--user-data-dir={temp_profile}",
            "--no-pdf-header-footer",
            f"--print-to-pdf={abs_pdf}",
            file_url,
        ]

        popen_kwargs: dict = {
            "stdout": subprocess.DEVNULL,
            "stderr": subprocess.DEVNULL,
        }
        if sys.platform == "win32":
            popen_kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW

        p = subprocess.Popen(cmd, **popen_kwargs)
        start_time = time.monotonic()
        poll_interval = 0.25

        try:
            while True:
                if os.path.exists(abs_pdf) and os.path.getsize(abs_pdf) > 1024:
                    # File generated, give Chrome 0.5s to finish flushing handles
                    time.sleep(0.5)
                    _terminate_proc_safely(p)
                    return True

                ret = p.poll()
                if ret is not None:
                    # Process exited
                    time.sleep(0.3)
                    return os.path.exists(abs_pdf) and os.path.getsize(abs_pdf) > 1024

                if time.monotonic() - start_time > timeout:
                    _terminate_proc_safely(p)
                    return False

                time.sleep(poll_interval)
        finally:
            _terminate_proc_safely(p)

    try:
        success = run_chrome_worker("--headless=new")
        if not success:
            # Fallback for older Chromium versions
            success = run_chrome_worker("--headless")

        if not success or not os.path.exists(abs_pdf) or os.path.getsize(abs_pdf) < 1024:
            raise RuntimeError(f"Headless Chrome failed to generate valid PDF at {abs_pdf}")

        # PyMuPDF integrity verification
        doc = pymupdf.open(abs_pdf)
        if doc.page_count < 1:
            doc.close()
            raise RuntimeError(f"Generated PDF has 0 pages: {abs_pdf}")
        doc.close()

    finally:
        shutil.rmtree(temp_profile, ignore_errors=True)


class PDFCompiler:
    """Document compiler producing production-ready _DeBai.pdf and _DapAn.pdf."""

    def __init__(self, chrome_path: str | None = None) -> None:
        self.chrome_path = chrome_path or find_chrome_path()

    @staticmethod
    def ensure_katex_bundle(target_dir: str) -> None:
        """Mirror local KaTeX vendor assets into target_dir/katex for offline resolution."""
        # Find local vendor KaTeX
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        katex_source = os.path.join(base_dir, "assets", "katex")

        dest_katex = os.path.join(target_dir, "katex")
        if not os.path.exists(dest_katex) and os.path.exists(katex_source):
            try:
                shutil.copytree(katex_source, dest_katex)
            except Exception:
                pass

    def compile_both(
        self,
        doc_ir: CanonicalDocumentIR,
        output_dir: str,
        prefix: str = "DeThi",
        preset: StylePreset | str | None = None,
        force_break_ids: set[str] | None = None,
        timeout: float = 45.0,
    ) -> tuple[str, str]:
        """
        Compile both `{prefix}_DeBai.pdf` and `{prefix}_DapAn.pdf` from CanonicalDocumentIR.
        Returns: (debai_pdf_path, dapan_pdf_path)
        """
        os.makedirs(output_dir, exist_ok=True)
        clean_prefix = sanitize_filename_prefix(prefix)

        # Setup local KaTeX vendor bundle in output_dir
        self.ensure_katex_bundle(output_dir)

        # Resolve style preset
        renderer = DocumentHTMLRenderer(preset=preset)

        # 1. Render and compile Worksheet (DeBai)
        debai_html_path = os.path.join(output_dir, f"{clean_prefix}_DeBai.html")
        debai_pdf_path = os.path.join(output_dir, f"{clean_prefix}_DeBai.pdf")

        # Initial render: allow natural CSS paged media containment, honoring explicit user force_break_ids
        initial_breaks = force_break_ids if force_break_ids is not None else set()
        worksheet_html = renderer.render_worksheet(doc_ir, force_break_ids=initial_breaks)
        with open(debai_html_path, "w", encoding="utf-8") as f:
            f.write(worksheet_html)

        compile_html_to_pdf(
            chrome_path=self.chrome_path,
            html_path=debai_html_path,
            pdf_path=debai_pdf_path,
            timeout=timeout,
        )

        # Post-render measurement and integrity verification pass
        measurements = LayoutSolver.measure_pdf_rendered_questions(debai_pdf_path, doc_ir)

        # Check for unintended question splits (where stem and options broke across pages)
        unintended_splits = [
            qid for qid, m in measurements.items()
            if m.get("is_split") and (f"opt:{qid}" not in initial_breaks)
        ]

        if unintended_splits:
            # Re-plan using real measured dimensions to eliminate unintended splits
            refined_breaks = LayoutSolver.plan_atomic_pagination(
                doc_ir=doc_ir,
                preset=renderer.preset,
                force_break_ids=force_break_ids,
                rendered_measurements=measurements,
            )
            worksheet_html = renderer.render_worksheet(doc_ir, force_break_ids=refined_breaks, rendered_measurements=measurements)
            with open(debai_html_path, "w", encoding="utf-8") as f:
                f.write(worksheet_html)

            compile_html_to_pdf(
                chrome_path=self.chrome_path,
                html_path=debai_html_path,
                pdf_path=debai_pdf_path,
                timeout=timeout,
            )

        # 2. Render and compile Answer Key (DapAn)
        dapan_html_path = os.path.join(output_dir, f"{clean_prefix}_DapAn.html")
        dapan_pdf_path = os.path.join(output_dir, f"{clean_prefix}_DapAn.pdf")

        answer_html = renderer.render_answer_key(doc_ir)
        with open(dapan_html_path, "w", encoding="utf-8") as f:
            f.write(answer_html)

        compile_html_to_pdf(
            chrome_path=self.chrome_path,
            html_path=dapan_html_path,
            pdf_path=dapan_pdf_path,
            timeout=timeout,
        )

        return debai_pdf_path, dapan_pdf_path
