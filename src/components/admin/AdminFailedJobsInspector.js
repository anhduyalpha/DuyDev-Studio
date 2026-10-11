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
            class="px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
            title="Xuất toàn bộ nhật ký lỗi đã lọc trùng ra file .txt để tải về"
          >
            <i data-lucide="download" class="w-3.5 h-3.5"></i>
            <span>Xuất Log Lỗi (.txt)</span>
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
    const normError = normalizeErrorMessageToEnglish(j.errorMessage);
    const sig = `${j.type || 'unknown'}::${normError.toLowerCase().replace(/\s+/g, ' ')}`;

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
        type: j.type || 'unknown',
        normalizedError: normError,
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
  lines.push(`Deduplication Mode   : ENABLED (Grouped by Engine + Normalized Root Cause)`);
  lines.push(sep100);
  lines.push('');

  if (totalErrors === 0) {
    lines.push('>>> TRẠNG THÁI HỆ THỐNG HOÀN TOÀN KHỎE MẠNH (ALL SYSTEMS HEALTHY) <<<');
    lines.push('Không có tác vụ nào bị lỗi. Toàn bộ các công cụ đang hoạt động bình thường.');
    lines.push(sep100);
    return { text: lines.join('\n'), fileName, uniqueCount: 0 };
  }

  lines.push(sepDash);
  lines.push('[1] BẢNG TỔNG HỢP PHÂN BỐ LỖI HỆ THỐNG (ERROR SIGNATURE DISTRIBUTION)');
  lines.push(sepDash);
  lines.push('Index | Engine / Module       | Count | Share (%) | First Occurrence    | Latest Occurrence');
  lines.push('------+-----------------------+-------+-----------+---------------------+--------------------');

  groups.forEach((g, idx) => {
    const idxStr = `#${String(idx + 1).padStart(2, '0')}`;
    const engineStr = (g.type || 'unknown').padEnd(21).slice(0, 21);
    const countStr = String(g.count).padStart(5);
    const share = totalErrors > 0 ? ((g.count / totalErrors) * 100).toFixed(1) : '0.0';
    const shareStr = `${share}%`.padStart(9);
    const firstStr = g.firstSeen.toISOString().replace('T', ' ').slice(0, 19);
    const lastStr = g.lastSeen.toISOString().replace('T', ' ').slice(0, 19);
    lines.push(`${idxStr}   | ${engineStr} | ${countStr} | ${shareStr} | ${firstStr} | ${lastStr}`);
  });
  lines.push(sepDash);
  lines.push('');

  lines.push(sepDash);
  lines.push('[2] CHI TIẾT NGUYÊN NHÂN LỖI ĐÃ LỌC TRÙNG (DEDUPLICATED ROOT CAUSE CATALOG)');
  lines.push(sepDash);

  groups.forEach((g, idx) => {
    const share = totalErrors > 0 ? ((g.count / totalErrors) * 100).toFixed(1) : '0.0';
    lines.push('');
    lines.push(`>>> ROOT CAUSE #${String(idx + 1).padStart(2, '0')} <<<`);
    lines.push(`Engine / Module      : ${String(g.type).toUpperCase()} (${g.type})`);
    lines.push(`Frequency            : ${g.count} occurrences (${share}% of all failures)`);
    lines.push(`First Detected       : ${g.firstSeen.toISOString().replace('T', ' ').slice(0, 19)}`);
    lines.push(`Latest Detected      : ${g.lastSeen.toISOString().replace('T', ' ').slice(0, 19)}`);
    lines.push(`Normalized Error     : ${g.normalizedError}`);

    const filesList = Array.from(g.fileNames);
    if (filesList.length > 0) {
      lines.push(`Affected Files (${filesList.length})  : ${filesList.slice(0, 10).join(', ')}${filesList.length > 10 ? ` ... (+${filesList.length - 10} more)` : ''}`);
    }

    lines.push(`Sample Job IDs (${g.jobIds.length})  : ${g.jobIds.slice(0, 8).map(id => `#${String(id).slice(0, 10)}`).join(', ')}${g.jobIds.length > 8 ? ` ... (+${g.jobIds.length - 8} more)` : ''}`);

    if (g.sampleOptions) {
      lines.push('Sample Input Payload :');
      try {
        const pretty = JSON.stringify(g.sampleOptions, null, 2).split('\n').map(l => `    ${l}`).join('\n');
        lines.push(pretty);
      } catch {
        lines.push(`    ${String(g.sampleOptions)}`);
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
