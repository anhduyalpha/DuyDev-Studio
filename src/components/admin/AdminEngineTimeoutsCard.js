/**
 * AdminEngineTimeoutsCard.js - Dynamic Engine Watchdog Timeout Configuration
 * Allows configuring AI call timeout, headless Chrome PDF compilation timeout,
 * PDF processing watchdog, and universal converter timeouts without restarts.
 */

import { getStorageAuthHeaders } from '../../utilities/adminAuth.js';
import { showToast } from '../../utilities/toast.js';

let cachedTimeouts = {
  aiCallSec: 120,
  chromePdfSec: 60,
  pdfHeavyTaskSec: 180,
  converterTaskSec: 300
};

export function renderEngineTimeoutsCard(timeouts = null) {
  if (timeouts) {
    cachedTimeouts = { ...cachedTimeouts, ...timeouts };
  }

  const { aiCallSec, chromePdfSec, pdfHeavyTaskSec, converterTaskSec } = cachedTimeouts;

  return `
    <div id="adminEngineTimeoutsCard" class="p-6 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 backdrop-blur-xl shadow-xl space-y-5">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-inner">
            <i data-lucide="timer" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Thời Gian Chờ Động Của Engine (Engine Timeouts)
              </h3>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Tự động áp dụng
              </span>
            </div>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Điều chỉnh giới hạn watchdog timeout của các tiến trình nền để ngăn treo hệ thống hoặc lỗi do tệp lớn
            </p>
          </div>
        </div>

        <button
          type="button"
          id="btnSaveEngineTimeouts"
          class="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all cursor-pointer active:scale-95 border border-orange-400/30"
        >
          <i data-lucide="save" class="w-4 h-4"></i>
          <span>Lưu Cấu Hình Timeout</span>
        </button>
      </div>

      <!-- Controls Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- 1. AI API Call Timeout -->
        <div class="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-white/5 space-y-2.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <i data-lucide="bot" class="w-3.5 h-3.5 text-orange-500"></i>
              <span>AI API Call Timeout</span>
            </span>
            <span class="font-mono font-bold text-orange-600 dark:text-orange-400" id="valAiCallSec">${aiCallSec}s</span>
          </div>
          <input
            type="range"
            id="sliderAiCallSec"
            min="10"
            max="600"
            step="5"
            value="${aiCallSec}"
            class="w-full accent-orange-500 cursor-pointer"
          />
          <div class="flex justify-between text-[10px] text-zinc-400 font-mono">
            <span>10s</span>
            <span>Mặc định: 120s</span>
            <span>600s</span>
          </div>
        </div>

        <!-- 2. Headless Chrome PDF Compilation Timeout -->
        <div class="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-white/5 space-y-2.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <i data-lucide="printer" class="w-3.5 h-3.5 text-blue-500"></i>
              <span>Chrome Headless PDF Timeout</span>
            </span>
            <span class="font-mono font-bold text-blue-600 dark:text-blue-400" id="valChromePdfSec">${chromePdfSec}s</span>
          </div>
          <input
            type="range"
            id="sliderChromePdfSec"
            min="10"
            max="300"
            step="5"
            value="${chromePdfSec}"
            class="w-full accent-blue-500 cursor-pointer"
          />
          <div class="flex justify-between text-[10px] text-zinc-400 font-mono">
            <span>10s</span>
            <span>Mặc định: 60s</span>
            <span>300s</span>
          </div>
        </div>

        <!-- 3. PDF Heavy Task Timeout -->
        <div class="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-white/5 space-y-2.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <i data-lucide="file-text" class="w-3.5 h-3.5 text-amber-500"></i>
              <span>PDF Heavy Task Watchdog</span>
            </span>
            <span class="font-mono font-bold text-amber-600 dark:text-amber-400" id="valPdfHeavyTaskSec">${pdfHeavyTaskSec}s</span>
          </div>
          <input
            type="range"
            id="sliderPdfHeavyTaskSec"
            min="30"
            max="1800"
            step="10"
            value="${pdfHeavyTaskSec}"
            class="w-full accent-amber-500 cursor-pointer"
          />
          <div class="flex justify-between text-[10px] text-zinc-400 font-mono">
            <span>30s</span>
            <span>Mặc định: 180s</span>
            <span>1800s</span>
          </div>
        </div>

        <!-- 4. Universal Converter Timeout -->
        <div class="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-white/5 space-y-2.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-indigo-500"></i>
              <span>Universal Converter Watchdog</span>
            </span>
            <span class="font-mono font-bold text-indigo-600 dark:text-indigo-400" id="valConverterTaskSec">${converterTaskSec}s</span>
          </div>
          <input
            type="range"
            id="sliderConverterTaskSec"
            min="30"
            max="3600"
            step="10"
            value="${converterTaskSec}"
            class="w-full accent-indigo-500 cursor-pointer"
          />
          <div class="flex justify-between text-[10px] text-zinc-400 font-mono">
            <span>30s</span>
            <span>Mặc định: 300s</span>
            <span>3600s</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function attachEngineTimeoutsListeners(container, onSaved = null) {
  if (!container) return;

  const sAi = container.querySelector('#sliderAiCallSec');
  const vAi = container.querySelector('#valAiCallSec');
  const sChrome = container.querySelector('#sliderChromePdfSec');
  const vChrome = container.querySelector('#valChromePdfSec');
  const sPdf = container.querySelector('#sliderPdfHeavyTaskSec');
  const vPdf = container.querySelector('#valPdfHeavyTaskSec');
  const sConv = container.querySelector('#sliderConverterTaskSec');
  const vConv = container.querySelector('#valConverterTaskSec');

  if (sAi && vAi) {
    sAi.oninput = () => { vAi.textContent = `${sAi.value}s`; };
  }
  if (sChrome && vChrome) {
    sChrome.oninput = () => { vChrome.textContent = `${sChrome.value}s`; };
  }
  if (sPdf && vPdf) {
    sPdf.oninput = () => { vPdf.textContent = `${sPdf.value}s`; };
  }
  if (sConv && vConv) {
    sConv.oninput = () => { vConv.textContent = `${sConv.value}s`; };
  }

  const btnSave = container.querySelector('#btnSaveEngineTimeouts');
  if (btnSave) {
    btnSave.onclick = async () => {
      const origHtml = btnSave.innerHTML;
      btnSave.disabled = true;
      btnSave.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i><span>Đang lưu...</span>';
      if (window.lucide) window.lucide.createIcons();

      const payload = {
        aiCallSec: Number(sAi ? sAi.value : cachedTimeouts.aiCallSec),
        chromePdfSec: Number(sChrome ? sChrome.value : cachedTimeouts.chromePdfSec),
        pdfHeavyTaskSec: Number(sPdf ? sPdf.value : cachedTimeouts.pdfHeavyTaskSec),
        converterTaskSec: Number(sConv ? sConv.value : cachedTimeouts.converterTaskSec)
      };

      try {
        const resp = await fetch('/api/v1/admin/config/engine-timeouts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() },
          body: JSON.stringify(payload)
        });
        const json = await resp.json();
        if (json.success && json.data) {
          cachedTimeouts = json.data;
          showToast('Đã lưu cấu hình timeout thành công!', 'success');
          if (onSaved) onSaved(cachedTimeouts);
        } else {
          showToast(json.message || 'Không thể lưu cấu hình timeout', 'error');
        }
      } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
      } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = origHtml;
        if (window.lucide) window.lucide.createIcons();
      }
    };
  }

  if (window.lucide) window.lucide.createIcons();
}

export async function fetchEngineTimeouts() {
  try {
    const resp = await fetch('/api/v1/admin/config/engine-timeouts', {
      headers: { ...getStorageAuthHeaders() }
    });
    const json = await resp.json();
    if (json.success && json.data) {
      cachedTimeouts = json.data;
      return json.data;
    }
  } catch (err) {
    console.warn('[AdminEngineTimeouts] Failed to load engine timeouts:', err);
  }
  return cachedTimeouts;
}
