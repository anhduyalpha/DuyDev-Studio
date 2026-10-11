/**
 * AdminFailedJobsInspector.js - Deep Diagnostics & Failed Jobs Inspector
 * Displays comprehensive error reasons, stack traces, payloads, and timestamps for failed worker jobs.
 */

import { getStorageAuthHeaders } from '../../utilities/adminAuth.js';
import { showToast } from '../../utilities/toast.js';
import { openSlideConfirmModal } from '../common/SlideConfirmModal.js';

let cachedFailedJobs = [];
let activeTypeFilter = 'all';

export function normalizeErrorMessageToEnglish(rawMsg) {
  if (!rawMsg || !String(rawMsg).trim()) {
    return 'Unknown error occurred.';
  }
  const trimmed = String(rawMsg).trim();
  const lower = trimmed.toLowerCase();

  if (lower.includes('cairosvg') && (lower.includes('yüklü değil') || lower.includes('yüklü') || lower.includes('not installed'))) {
    return "CairoSVG library is not installed: SVG conversion requires CairoSVG ('pip install cairosvg').";
  }
  if (lower.includes('resim dönüşüm hatası') || lower.includes('resim donusum hatasi') || (lower.includes('resim') && lower.includes('dönüşüm'))) {
    const details = trimmed.split(':').slice(1).join(':').trim();
    return details
      ? `Image conversion error: Failed to process source image (${details}).`
      : 'Image conversion error: Failed to process source image.';
  }
  if (lower.includes('ffmpeg hatası') || lower.includes('ffmpeg hatasi')) {
    const details = trimmed.split(':').slice(1).join(':').trim();
    return details
      ? `FFmpeg encoding error: Media stream conversion failed (${details}).`
      : 'FFmpeg encoding error: Media stream conversion failed.';
  }
  if (lower.includes('sayfa dönüştürülemedi') || lower.includes('sayfa donusturulemedi')) {
    return 'Page rendering error: Could not convert document page.';
  }
  if (lower.includes('dosya bulunamadı') || lower.includes('dosya bulunamadi')) {
    return 'File not found: Source path does not exist.';
  }
  if (lower.includes('geçersiz dosya formatı') || lower.includes('gecersiz dosya formati')) {
    return 'Invalid file format: Unrecognized or unsupported file type.';
  }
  if (lower.includes('bellek yetersiz') || lower.includes('yetersiz bellek')) {
    return 'Out of memory: Insufficient RAM for processing.';
  }
  if (lower.includes('zaman aşımı') || lower.includes('zaman asimi')) {
    return 'Operation timed out: Process exceeded maximum execution time.';
  }
  if (lower.includes('lỗi không xác định')) {
    return 'Unknown error occurred.';
  }
  if (lower.includes('không thể đưa tác vụ') && lower.includes('vào hàng đợi')) {
    return 'Queue failure: Unable to enqueue processing task. Please try again.';
  }
  if (lower.includes('không thể xếp hàng tạo bài tập trắc nghiệm')) {
    return 'Queue failure: Unable to enqueue quiz generation task. Please try again.';
  }

  return trimmed;
}

/**
 * Classifies error message into standardized semantic category and actionable fix hints
 */
export function extractSemanticErrorDetailsClient(rawMsg, jobType = '') {
  if (!rawMsg || !String(rawMsg).trim()) {
    return {
      category: 'System Core',
      rootCauseTitle: 'Unknown Error (Không xác định nguyên nhân)',
      normalizedSummary: 'Unknown error occurred.',
      severity: 'ERROR',
      suggestedFix: 'Kiểm tra optionsJson và worker trace log để tái hiện lỗi.',
      signature: 'system::unknown_error'
    };
  }

  const trimmed = String(rawMsg).trim();
  const lower = trimmed.toLowerCase();
  const t = String(jobType || '').toLowerCase();
  let category = 'System Core';
  if (t.includes('conv') || t.includes('media') || t.includes('format')) category = 'Universal Converter';
  else if (t.includes('pdf')) category = 'PDF Studio Pro';
  else if (t.includes('quiz')) category = 'Quiz Generator';

  // 1. CairoSVG Missing
  if (lower.includes('cairosvg')) {
    return {
      category: 'Universal Converter',
      rootCauseTitle: 'CairoSVG Library Missing (Thiếu thư viện cairosvg)',
      normalizedSummary: "CairoSVG library is not installed: SVG conversion requires CairoSVG ('pip install cairosvg').",
      signature: 'converter::cairosvg_missing',
      severity: 'CRITICAL',
      suggestedFix: "Cài đặt CairoSVG trên máy chủ ('sudo apt install libcairo2 && pip install cairosvg')."
    };
  }

  // 2. PyPDF2 Missing
  if (lower.includes('pypdf2')) {
    return {
      category: 'Universal Converter',
      rootCauseTitle: 'PyPDF2 Deprecated / Missing (Thiếu thư viện PyPDF2)',
      normalizedSummary: "PyPDF2 module is not installed ('pip install PyPDF2' or migrate to pypdf / pymupdf).",
      signature: 'converter::pypdf2_missing',
      severity: 'CRITICAL',
      suggestedFix: "Cài đặt PyPDF2 ('pip install PyPDF2') hoặc chuyển sang sử dụng PyMuPDF (fitz)."
    };
  }

  // 3. LibreOffice Missing
  if (lower.includes('soffice') || lower.includes('libreoffice')) {
    return {
      category: 'Universal Converter',
      rootCauseTitle: 'LibreOffice Binary Missing (Thiếu bộ công cụ LibreOffice)',
      normalizedSummary: 'LibreOffice headless binary is not available for office document conversion.',
      signature: 'converter::libreoffice_missing',
      severity: 'CRITICAL',
      suggestedFix: "Cài đặt LibreOffice trên máy chủ ('sudo apt install libreoffice-headless libreoffice-writer libreoffice-calc')."
    };
  }

  // 4. pdf2docx Missing
  if (lower.includes('pdf2docx')) {
    return {
      category: 'PDF Studio Pro',
      rootCauseTitle: 'pdf2docx Library Missing (Thiếu thư viện pdf2docx)',
      normalizedSummary: "pdf2docx library is required for PDF to DOCX conversion ('pip install pdf2docx').",
      signature: 'pdf::pdf2docx_missing',
      severity: 'CRITICAL',
      suggestedFix: "Cài đặt pdf2docx trong môi trường Python: 'pip install pdf2docx'."
    };
  }

  // 5. Python NameError 'Any'
  if (lower.includes("name 'any' is not defined") || lower.includes("nameerror: name 'any'")) {
    return {
      category: 'Quiz Generator',
      rootCauseTitle: "Python NameError: 'Any' Not Defined",
      normalizedSummary: "NameError: name 'Any' is not defined in quiz engine Python script.",
      signature: 'quiz::nameerror_any',
      severity: 'ERROR',
      suggestedFix: "Thêm 'from typing import Any' vào đầu file Python bị lỗi (engines/quiz/quiz_pipeline.py hoặc orchestrator)."
    };
  }

  // 6. AttributeError 'DiagnosticLayer'
  if (lower.includes('diagnosticlayer') && lower.includes('reconstruction_failure')) {
    return {
      category: 'Quiz Generator',
      rootCauseTitle: "Python AttributeError: 'DiagnosticLayer.RECONSTRUCTION_FAILURE' Missing",
      normalizedSummary: "AttributeError: type object 'DiagnosticLayer' has no attribute 'RECONSTRUCTION_FAILURE'.",
      signature: 'quiz::diagnostic_layer_reconstruction_failure',
      severity: 'ERROR',
      suggestedFix: "Định nghĩa enum / hằng số RECONSTRUCTION_FAILURE trong class DiagnosticLayer hoặc import đúng module."
    };
  }

  // 7. Agnes AI API Timeout
  if (lower.includes('agnes ai api') || lower.includes('the read operation timed out') || lower.includes('timeouterror')) {
    return {
      category: 'Quiz Generator',
      rootCauseTitle: 'Agnes AI API Gateway Timeout / Network Read Timeout',
      normalizedSummary: 'TimeoutError: The read operation timed out while communicating with Agnes AI API.',
      signature: 'quiz::agnes_timeout',
      severity: 'TIMEOUT',
      suggestedFix: "Kiểm tra độ trễ mạng đến endpoint Agnes AI, mở rộng timeout hoặc kích hoạt fallback API Key dự phòng."
    };
  }

  // 8. Google Drive Download Error
  if (lower.includes('google drive') || lower.includes('download_gdrive') || lower.includes('gdrive')) {
    return {
      category: 'Quiz / Drive Import',
      rootCauseTitle: 'Google Drive Download Failure (HTTP 404 / Quyền truy cập riêng tư)',
      normalizedSummary: 'Cannot download file from Google Drive: HTTP 404 Not Found or link is not public.',
      signature: 'quiz::gdrive_download_404',
      severity: 'NETWORK',
      suggestedFix: "Đảm bảo liên kết Google Drive được bật chia sẻ công khai ('Bất kỳ ai có đường liên kết đều có thể xem')."
    };
  }

  // 9. Prisma Database Query Error
  if (lower.includes('filerecordwhereuniqueinput') || lower.includes('filerecord.findunique')) {
    return {
      category: 'System Backend',
      rootCauseTitle: 'Prisma Query Error: FileRecord where.id is undefined',
      normalizedSummary: 'Argument where of type FileRecordWhereUniqueInput received undefined id.',
      signature: 'backend::prisma_filerecord_undefined',
      severity: 'ERROR',
      suggestedFix: "Kiểm tra logic gọi prisma.fileRecord.findUnique: đảm bảo tham số fileId đã được truyền trước khi query."
    };
  }

  // 10. Question Range Mismatch
  if (lower.includes('dải câu hỏi') || lower.includes('không thấy đủ số câu') || lower.includes('chưa thấy đủ số câu') || lower.includes('nghía lại số trang')) {
    return {
      category: 'Quiz Generator',
      rootCauseTitle: 'Question Count Range Mismatch (Dải câu hỏi trích xuất không khớp)',
      normalizedSummary: 'Extracted question count does not match user requested range.',
      signature: 'quiz::question_count_mismatch',
      severity: 'WARNING',
      suggestedFix: "Kiểm tra định dạng đề thi PDF (số câu, thứ tự cột) hoặc kiểm tra lại khoảng trang người dùng đã chỉ định."
    };
  }

  // 11. No Questions Detected
  if (lower.includes('không có câu hỏi trong trang') || lower.includes('không tìm thấy câu hỏi')) {
    return {
      category: 'Quiz Generator',
      rootCauseTitle: 'No Questions Detected on Selected Page (Không tìm thấy câu hỏi trên trang)',
      normalizedSummary: 'No multiple-choice questions found within the selected document pages.',
      signature: 'quiz::no_questions_on_page',
      severity: 'WARNING',
      suggestedFix: "Kiểm tra xem trang đã chọn có chứa câu hỏi trắc nghiệm hay là trang bìa/mục lục."
    };
  }

  // 12. Question Option Text Empty
  if (lower.includes('has empty text for option') || (lower.includes('câu') && lower.includes('option') && lower.includes('empty'))) {
    return {
      category: 'Quiz Generator',
      rootCauseTitle: 'Question Option Text Empty (Lựa chọn A/B/C/D bị rỗng)',
      normalizedSummary: "Extracted question has empty option text (e.g. Option 'A' is blank).",
      signature: 'quiz::empty_option_text',
      severity: 'WARNING',
      suggestedFix: "Cải thiện regex bóc tách phương án lựa chọn trong quiz_pipeline.py đối với câu hỏi có bảng biểu."
    };
  }

  // 13. Timeout
  if (lower.includes('vượt quá giới hạn thời gian') || lower.includes('quá hạn') || lower.includes('timed out') || lower.includes('zaman aşımı')) {
    return {
      category,
      rootCauseTitle: 'Worker Execution Timeout (Tác vụ vượt quá giới hạn thời gian)',
      normalizedSummary: 'Operation timed out: Process exceeded maximum execution time watchdog.',
      signature: `${category.toLowerCase().replace(/\s+/g, '_')}::timeout`,
      severity: 'TIMEOUT',
      suggestedFix: "Tối ưu hóa thuật toán xử lý hoặc tăng ngưỡng giới hạn watchdog timeout đối với các tệp lớn."
    };
  }

  // 14. Fallback
  const norm = normalizeErrorMessageToEnglish(trimmed);
  const sig = `${category.toLowerCase().replace(/\s+/g, '_')}::${norm.toLowerCase().slice(0, 50).replace(/[^a-z0-9]/g, '_')}`;
  return {
    category,
    rootCauseTitle: norm.slice(0, 70),
    normalizedSummary: norm,
    signature: sig,
    severity: 'ERROR',
    suggestedFix: 'Kiểm tra log chi tiết và optionsJson để tái hiện lỗi.'
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s trước`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h trước`;
  const days = Math.floor(hr / 24);
  return `${days}d trước`;
}

function formatExactTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function getJobTypeBadge(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('pdf')) {
    return `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">PDF Studio</span>`;
  }
  if (t.includes('conv') || t.includes('media')) {
    return `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">Universal Converter</span>`;
  }
  if (t.includes('quiz')) {
    return `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">Quiz Generator</span>`;
  }
  return `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">${escapeHtml(type || 'Unknown')}</span>`;
}

/**
 * Renders the HTML markup for the Failed Jobs Inspector card
 */
export function renderFailedJobsInspector(jobs = []) {
  cachedFailedJobs = jobs;
  const filteredJobs = activeTypeFilter === 'all'
    ? jobs
    : jobs.filter(j => String(j.type || '').toLowerCase().includes(activeTypeFilter));

  return `
    <div id="adminFailedJobsCard" class="p-6 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 backdrop-blur-xl shadow-xl space-y-5">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0 shadow-inner">
            <i data-lucide="alert-octagon" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Nhật Ký Lỗi & Tác Vụ Thất Bại (Failed Jobs Diagnostics)
              </h3>
              <span id="adminFailedJobsCountBadge" class="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${jobs.length > 0 ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'}">
                ${jobs.length} lỗi
              </span>
            </div>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Truy vết nguyên nhân gốc rễ, stack trace và tham số đầu vào khi các worker nền gặp sự cố
            </p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            id="btnRefreshFailedJobs"
            class="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
            title="Làm mới danh sách lỗi"
          >
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Làm Mới</span>
          </button>
          <button
            type="button"
            id="btnExportFailedJobsTxt"
            class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-medium text-xs flex items-center gap-2 shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all cursor-pointer active:scale-95 border border-orange-400/30"
            title="Xuất toàn bộ nhật ký lỗi ra file .txt đã gom nhóm & lọc trùng cho lập trình viên fix"
          >
            <i data-lucide="file-down" class="w-4 h-4 shrink-0"></i>
            <span class="font-bold">Xuất Toàn Bộ Lỗi (.txt)</span>
            <span class="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-mono tracking-tight uppercase">Lọc trùng</span>
          </button>
          ${jobs.length > 0 ? `
            <button
              type="button"
              id="btnClearFailedJobs"
              class="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
              title="Dọn sạch toàn bộ nhật ký lỗi"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              <span>Dọn Sạch Lỗi</span>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Filter Pills -->
      <div class="flex items-center gap-2 border-b border-zinc-100 dark:border-white/5 pb-3 overflow-x-auto text-xs font-medium">
        <button
          type="button"
          data-filter-type="all"
          class="btn-failed-filter px-3 py-1 rounded-lg transition cursor-pointer ${activeTypeFilter === 'all' ? 'bg-orange-500 text-white font-bold shadow-xs' : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}"
        >
          Tất cả (${jobs.length})
        </button>
        <button
          type="button"
          data-filter-type="pdf"
          class="btn-failed-filter px-3 py-1 rounded-lg transition cursor-pointer ${activeTypeFilter === 'pdf' ? 'bg-orange-500 text-white font-bold shadow-xs' : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}"
        >
          PDF Studio (${jobs.filter(j => String(j.type || '').toLowerCase().includes('pdf')).length})
        </button>
        <button
          type="button"
          data-filter-type="conv"
          class="btn-failed-filter px-3 py-1 rounded-lg transition cursor-pointer ${activeTypeFilter === 'conv' ? 'bg-orange-500 text-white font-bold shadow-xs' : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}"
        >
          Converter (${jobs.filter(j => String(j.type || '').toLowerCase().includes('conv') || String(j.type || '').toLowerCase().includes('media')).length})
        </button>
        <button
          type="button"
          data-filter-type="quiz"
          class="btn-failed-filter px-3 py-1 rounded-lg transition cursor-pointer ${activeTypeFilter === 'quiz' ? 'bg-orange-500 text-white font-bold shadow-xs' : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}"
        >
          Quiz (${jobs.filter(j => String(j.type || '').toLowerCase().includes('quiz')).length})
        </button>
      </div>

      <!-- List Container -->
      <div id="adminFailedJobsList" class="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        ${renderFailedJobsItemsMarkup(filteredJobs)}
      </div>
    </div>
  `;
}

function renderFailedJobsItemsMarkup(jobs) {
  if (!jobs || jobs.length === 0) {
    return `
      <div class="py-12 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-white/5 space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
          <i data-lucide="shield-check" class="w-6 h-6"></i>
        </div>
        <div class="max-w-sm">
          <p class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Không có tác vụ nào bị lỗi</p>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Toàn bộ các tác vụ xử lý tài liệu, chuyển đổi đa phương tiện và trắc nghiệm đang hoạt động hoàn hảo mà không phát sinh lỗi.
          </p>
        </div>
      </div>
    `;
  }

  return jobs.map(job => {
    const duration = job.durationMs != null ? `${(job.durationMs / 1000).toFixed(2)}s` : '--';
    const cleanError = escapeHtml(normalizeErrorMessageToEnglish(job.errorMessage));
    const jsonPretty = escapeHtml(typeof job.options === 'object' ? JSON.stringify(job.options, null, 2) : String(job.optionsRaw || '{}'));

    return `
      <div class="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5 space-y-3 hover:border-rose-500/30 transition shadow-xs">
        <!-- Top Row -->
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div class="flex items-center gap-2">
            ${getJobTypeBadge(job.type)}
            <span class="font-mono text-zinc-500 dark:text-zinc-400 text-[11px]" title="${escapeHtml(job.id)}">
              #${escapeHtml(job.id.substring(0, 10))}...
            </span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              FAILED
            </span>
          </div>

          <div class="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
            <span>Thời lượng: <strong class="text-zinc-800 dark:text-zinc-200">${duration}</strong></span>
            <span>${formatRelativeTime(job.createdAt)} (${formatExactTime(job.createdAt)})</span>
          </div>
        </div>

        <!-- Error Reason Callout -->
        <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-300 text-xs font-mono space-y-1">
          <div class="flex items-start gap-2">
            <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-500 shrink-0 mt-0.5"></i>
            <div class="flex-1 whitespace-pre-wrap break-all leading-relaxed">${cleanError}</div>
          </div>
        </div>

        <!-- Expandable Options / Payload Container -->
        <div>
          <button
            type="button"
            data-toggle-job-payload="${escapeHtml(job.id)}"
            class="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 hover:text-orange-500 flex items-center gap-1.5 cursor-pointer transition select-none"
          >
            <i data-lucide="chevron-right" class="w-3.5 h-3.5 transition-transform" id="iconPayload_${escapeHtml(job.id)}"></i>
            <span>Xem tham số đầu vào (optionsJson)</span>
          </button>
          <div
            id="containerPayload_${escapeHtml(job.id)}"
            class="hidden mt-2 p-3 rounded-xl bg-zinc-900 text-zinc-200 font-mono text-[11px] overflow-x-auto max-h-48 border border-white/5 select-all"
          >
            <pre class="leading-relaxed">${jsonPretty}</pre>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Attaches interactive listeners to the Failed Jobs card
 */
export function attachFailedJobsListeners(container, onReload) {
  if (!container) return;

  // 1. Refresh button
  const btnRefresh = container.querySelector('#btnRefreshFailedJobs');
  if (btnRefresh) {
    btnRefresh.onclick = async () => {
      btnRefresh.disabled = true;
      btnRefresh.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> <span>Đang nạp...</span>';
      if (window.lucide) window.lucide.createIcons();

      try {
        const resp = await fetch('/api/v1/admin/logs/failed-jobs?limit=50', {
          headers: { ...getStorageAuthHeaders(), 'Accept': 'application/json' }
        });
        const json = await resp.json();
        if (json.success && Array.isArray(json.data?.jobs)) {
          cachedFailedJobs = json.data.jobs;
          const listEl = container.querySelector('#adminFailedJobsList');
          if (listEl) {
            const filtered = activeTypeFilter === 'all'
              ? cachedFailedJobs
              : cachedFailedJobs.filter(j => String(j.type || '').toLowerCase().includes(activeTypeFilter));
            listEl.innerHTML = renderFailedJobsItemsMarkup(filtered);
          }
          const badgeEl = container.querySelector('#adminFailedJobsCountBadge');
          if (badgeEl) {
            badgeEl.textContent = `${cachedFailedJobs.length} lỗi`;
          }
          showToast(`Đã làm mới: tìm thấy ${cachedFailedJobs.length} tác vụ lỗi`, 'info');
        }
      } catch (err) {
        showToast(`Lỗi khi nạp danh sách: ${err.message}`, 'error');
      } finally {
        btnRefresh.disabled = false;
        btnRefresh.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> <span>Làm Mới</span>';
        if (window.lucide) window.lucide.createIcons();
      }
    };
  }

  // 2. Export all failed jobs to TXT with deduplication
  const btnExport = container.querySelector('#btnExportFailedJobsTxt');
  if (btnExport) {
    btnExport.onclick = async () => {
      btnExport.disabled = true;
      const originalHtml = btnExport.innerHTML;
      btnExport.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> <span>Đang xử lý & lọc trùng...</span>';
      if (window.lucide) window.lucide.createIcons();

      try {
        const resp = await fetch('/api/v1/admin/logs/export-txt', {
          headers: { ...getStorageAuthHeaders(), 'Accept': 'text/plain' }
        });

        if (!resp.ok) {
          throw new Error(`Máy chủ phản hồi mã lỗi ${resp.status}`);
        }

        const totalErrors = resp.headers.get('X-Total-Errors') || '0';
        const uniqueErrors = resp.headers.get('X-Unique-Errors') || '0';
        const contentDisposition = resp.headers.get('Content-Disposition') || '';
        let fileName = `duydev-studio-error-logs-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.txt`;
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          fileName = match[1];
        }

        const text = await resp.text();
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`Đã tải về ${fileName}: ${totalErrors} lỗi (đã lọc trùng còn ${uniqueErrors} lỗi duy nhất)`, 'success');
      } catch (err) {
        console.warn('[AdminFailedJobs] Server export failed, falling back to client-side deduplication:', err);
        try {
          const clientExport = generateClientDeduplicatedExport(cachedFailedJobs);
          const blob = new Blob([clientExport.text], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = clientExport.fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          showToast(`Đã xuất ${cachedFailedJobs.length} lỗi (lọc trùng còn ${clientExport.uniqueCount} lỗi) qua trình duyệt`, 'success');
        } catch (clientErr) {
          showToast(`Lỗi khi xuất file: ${err.message}`, 'error');
        }
      } finally {
        btnExport.disabled = false;
        btnExport.innerHTML = originalHtml;
        if (window.lucide) window.lucide.createIcons();
      }
    };
  }

  // 3. Clear all failed jobs with Slide-To-Confirm verification
  const btnClear = container.querySelector('#btnClearFailedJobs');
  if (btnClear) {
    btnClear.onclick = () => {
      openSlideConfirmModal({
        title: 'Dọn sạch nhật ký tác vụ thất bại',
        description: `Xóa vĩnh viễn toàn bộ ${cachedFailedJobs.length} bản ghi lỗi trong SQLite và dọn các failed job trong BullMQ Redis queues.`,
        warningText: 'Thao tác này sẽ xóa sạch nhật ký truy vết lỗi hệ thống. Các tác vụ bị lỗi sẽ không còn hiển thị.',
        actionText: 'Kéo sang phải để dọn sạch lỗi',
        confirmingText: 'Đang dọn sạch nhật ký...',
        onConfirm: async () => {
          try {
            const resp = await fetch('/api/v1/admin/logs/clear-failed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() }
            });
            const json = await resp.json();
            showToast(json.message || 'Đã dọn sạch nhật ký lỗi', json.success ? 'success' : 'error');
            cachedFailedJobs = [];
            const listEl = container.querySelector('#adminFailedJobsList');
            if (listEl) listEl.innerHTML = renderFailedJobsItemsMarkup([]);
            const badgeEl = container.querySelector('#adminFailedJobsCountBadge');
            if (badgeEl) {
              badgeEl.textContent = '0 lỗi';
              badgeEl.className = 'px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
            }
            if (btnClear) btnClear.remove();
            if (onReload) onReload();
          } catch (err) {
            showToast(`Lỗi khi dọn nhật ký: ${err.message}`, 'error');
          }
        }
      });
    };
  }

  // 3. Filter pills
  container.querySelectorAll('.btn-failed-filter').forEach(btn => {
    btn.onclick = () => {
      const type = btn.dataset.filterType;
      activeTypeFilter = type;
      container.querySelectorAll('.btn-failed-filter').forEach(b => {
        const isActive = b.dataset.filterType === type;
        b.className = `btn-failed-filter px-3 py-1 rounded-lg transition cursor-pointer ${
          isActive
            ? 'bg-orange-500 text-white font-bold shadow-xs'
            : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
        }`;
      });

      const listEl = container.querySelector('#adminFailedJobsList');
      if (listEl) {
        const filtered = activeTypeFilter === 'all'
          ? cachedFailedJobs
          : cachedFailedJobs.filter(j => String(j.type || '').toLowerCase().includes(activeTypeFilter));
        listEl.innerHTML = renderFailedJobsItemsMarkup(filtered);
        if (window.lucide) window.lucide.createIcons();
      }
    };
  });

  // 4. Toggle payload container
  container.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('[data-toggle-job-payload]');
    if (!toggleBtn) return;
    const jobId = toggleBtn.dataset.toggleJobPayload;
    const targetEl = container.querySelector(`#containerPayload_${jobId}`);
    const iconEl = container.querySelector(`#iconPayload_${jobId}`);
    if (targetEl) {
      const isHidden = targetEl.classList.contains('hidden');
      if (isHidden) {
        targetEl.classList.remove('hidden');
        if (iconEl) iconEl.style.transform = 'rotate(90deg)';
      } else {
        targetEl.classList.add('hidden');
        if (iconEl) iconEl.style.transform = 'rotate(0deg)';
      }
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

/**
  * Generates client-side deduplicated error report for offline/fallback export
  */
export function generateClientDeduplicatedExport(jobs = []) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const fileTimestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `duydev-studio-error-logs-${fileTimestamp}.txt`;

  const totalErrors = jobs.length;
  const groupMap = new Map();

  for (const j of jobs) {
    const semantic = extractSemanticErrorDetailsClient(j.errorMessage, j.type);
    const sig = semantic.signature;

    let parsedOptions = j.options;
    if (!parsedOptions && j.optionsRaw) {
      try { parsedOptions = JSON.parse(j.optionsRaw); } catch { parsedOptions = j.optionsRaw; }
    }

    const fileNames = [];
    if (parsedOptions && typeof parsedOptions === 'object') {
      const candidate = parsedOptions.fileName || parsedOptions.filename || parsedOptions.name || parsedOptions.file;
      if (candidate) fileNames.push(candidate);
    }

    const cDate = j.createdAt ? new Date(j.createdAt) : now;

    if (!groupMap.has(sig)) {
      groupMap.set(sig, {
        category: semantic.category,
        rootCauseTitle: semantic.rootCauseTitle,
        normalizedSummary: semantic.normalizedSummary,
        severity: semantic.severity,
        suggestedFix: semantic.suggestedFix,
        types: new Set(j.type ? [j.type] : []),
        rawErrors: new Set(j.errorMessage ? [j.errorMessage] : []),
        count: 1,
        firstSeen: cDate,
        lastSeen: cDate,
        jobIds: [j.id],
        fileNames: new Set(fileNames),
        sampleOptions: parsedOptions
      });
    } else {
      const g = groupMap.get(sig);
      g.count++;
      if (j.type) g.types.add(j.type);
      if (cDate < g.firstSeen) g.firstSeen = cDate;
      if (cDate > g.lastSeen) g.lastSeen = cDate;
      g.jobIds.push(j.id);
      if (j.errorMessage) g.rawErrors.add(j.errorMessage);
      for (const fn of fileNames) g.fileNames.add(fn);
      if (!g.sampleOptions && parsedOptions) g.sampleOptions = parsedOptions;
    }
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => b.count - a.count);
  const uniqueCount = groups.length;
  const duplicatesMerged = Math.max(0, totalErrors - uniqueCount);
  const reductionPct = totalErrors > 0 ? ((duplicatesMerged / totalErrors) * 100).toFixed(1) : '0';

  const sep100 = '='.repeat(100);
  const sepDash = '-'.repeat(100);
  const lines = [];

  lines.push(sep100);
  lines.push('           DUYDEV STUDIO - SYSTEM ERROR DIAGNOSTICS & AUDIT LOG REPORT');
  lines.push('                     [DEDUPLICATED & CONSOLIDATED LOG EXPORT]');
  lines.push(sep100);
  lines.push(`Generated Date       : ${dateFormatted} (Local Client Time)`);
  lines.push(`Total Raw Failures   : ${totalErrors} records`);
  lines.push(`Unique Root Causes   : ${uniqueCount} distinct error signatures`);
  lines.push(`Duplicates Merged    : ${duplicatesMerged} redundant records eliminated (${reductionPct}% noise reduction)`);
  lines.push(`Deduplication Mode   : ENABLED (Grouped by Engine + Semantic Root Cause)`);
  lines.push(sep100);
  lines.push('');

  if (totalErrors === 0) {
    lines.push('>>> TRẠNG THÁI HỆ THỐNG HOÀN TOÀN KHỎE MẠNH (ALL SYSTEMS HEALTHY) <<<');
    lines.push('Không có tác vụ nào bị lỗi. Toàn bộ các công cụ đang hoạt động bình thường.');
    lines.push(sep100);
    return { text: lines.join('\n'), fileName, uniqueCount: 0 };
  }

  // Section 1: Bug Triage Summary Table
  lines.push(sepDash);
  lines.push('[1] MỤC LỤC & BẢNG PHÂN LOẠI LỖI (BUG TRIAGE SUMMARY TABLE)');
  lines.push(sepDash);
  lines.push('Index | Engine / Module       | Severity | Count | Share (%) | Root Cause Summary');
  lines.push('------+-----------------------+----------+-------+-----------+---------------------------------------------------');

  groups.forEach((g, idx) => {
    const idxStr = `#${String(idx + 1).padStart(2, '0')}`;
    const engineStr = (g.category || Array.from(g.types)[0] || 'unknown').padEnd(21).slice(0, 21);
    const sevStr = g.severity.padEnd(8).slice(0, 8);
    const countStr = String(g.count).padStart(5);
    const share = totalErrors > 0 ? ((g.count / totalErrors) * 100).toFixed(1) : '0.0';
    const shareStr = `${share}%`.padStart(9);
    const summaryStr = (g.rootCauseTitle || g.normalizedSummary).slice(0, 49);
    lines.push(`${idxStr}   | ${engineStr} | ${sevStr} | ${countStr} | ${shareStr} | ${summaryStr}`);
  });
  lines.push(sepDash);
  lines.push('');

  // Section 2: Actionable Bug Fix Tickets
  lines.push(sepDash);
  lines.push('[2] CHI TIẾT TỪNG PHIẾU LỖI ĐÃ GOM TRÙNG ĐỂ FIX (ACTIONABLE BUG FIX TICKETS)');
  lines.push('    (Được tối ưu cho kỹ sư / lập trình viên kiểm tra nguyên nhân gốc rễ và sửa code)');
  lines.push(sepDash);

  groups.forEach((g, idx) => {
    const share = totalErrors > 0 ? ((g.count / totalErrors) * 100).toFixed(1) : '0.0';
    const typesList = Array.from(g.types).join(', ') || 'n/a';
    const firstStr = g.firstSeen.toISOString().replace('T', ' ').slice(0, 19);
    const lastStr = g.lastSeen.toISOString().replace('T', ' ').slice(0, 19);

    lines.push('');
    lines.push(sep100);
    lines.push(`[PHIẾU LỖI #${String(idx + 1).padStart(2, '0')} / ${String(uniqueCount).padStart(2, '0')}] ${g.rootCauseTitle}`);
    lines.push(sepDash);
    lines.push(`* Phân hệ (Engine)    : ${g.category} (Job types: ${typesList})`);
    lines.push(`* Mức độ nghiêm trọng : [${g.severity}]`);
    lines.push(`* Tần suất xuất hiện  : ${g.count} lần (${share}% tổng số lỗi hệ thống)`);
    lines.push(`* Thời điểm ghi nhận  : Từ ${firstStr} đến ${lastStr}`);
    lines.push(`* Tóm tắt lỗi chuẩn   : ${g.normalizedSummary}`);
    lines.push(`* GỢI Ý KHẮC PHỤC     : >>> ${g.suggestedFix} <<<`);

    const filesList = Array.from(g.fileNames);
    if (filesList.length > 0) {
      lines.push(`* Tệp bị ảnh hưởng (${filesList.length}) : ${filesList.slice(0, 12).join(', ')}${filesList.length > 12 ? ` ... (+${filesList.length - 12} tệp khác)` : ''}`);
    }

    lines.push(`* Danh sách Job IDs   : ${g.jobIds.slice(0, 8).map(id => `#${String(id).slice(0, 12)}`).join(', ')}${g.jobIds.length > 8 ? ` ... (+${g.jobIds.length - 8} jobs khác)` : ''}`);

    if (g.sampleOptions) {
      lines.push('* Tham số mẫu (Input) :');
      try {
        const pretty = JSON.stringify(g.sampleOptions, null, 2).split('\n').map(l => `    ${l}`).join('\n');
        lines.push(pretty);
      } catch {
        lines.push(`    ${String(g.sampleOptions)}`);
      }
    }

    const rawList = Array.from(g.rawErrors);
    if (rawList.length > 0) {
      lines.push('* Chi tiết Traceback / Thông báo lỗi gốc :');
      rawList.slice(0, 3).forEach((raw, rIdx) => {
        const cleanRaw = String(raw).trim();
        lines.push(`    [Mẫu #${rIdx + 1}] ${cleanRaw.replace(/\n/g, '\n        ')}`);
      });
      if (rawList.length > 3) {
        lines.push(`    ... (+${rawList.length - 3} biến thể lỗi khác có cùng bản chất)`);
      }
    }

    lines.push(sepDash);
  });

  lines.push('');
  lines.push(sep100);
  lines.push('END OF DUYDEV STUDIO SYSTEM ERROR AUDIT REPORT');
  lines.push(sep100);

  return {
    text: lines.join('\n'),
    fileName,
    uniqueCount
  };
}
