/**
 * UploadProgressCard Component (< 110 lines)
 * Developer utility aesthetic with real-time percentage, speed, ETA, and pause/cancel controls.
 */

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function renderUploadProgressCard(telemetry = {}, fileName = 'Tệp tin', stage = 'Đang truyền tệp...') {
  const percent = telemetry.percent || 0;
  const speed = telemetry.formattedSpeed || '0 KB/s';
  const eta = telemetry.formattedEta || '--';
  const isPaused = Boolean(telemetry.isPaused);
  const uploaded = formatBytes(telemetry.uploadedBytes || 0);
  const total = formatBytes(telemetry.totalBytes || 0);

  return `
    <div id="uploadProgressCard" class="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 text-left space-y-3 shadow-lg animate-fadeIn">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center shrink-0">
            <i data-lucide="${isPaused ? 'pause' : 'upload-cloud'}" class="w-3.5 h-3.5 ${isPaused ? 'text-amber-400' : 'text-sky-400 animate-pulse'}"></i>
          </div>
          <div class="min-w-0">
            <div class="text-xs font-semibold text-zinc-100 truncate">${fileName}</div>
            <div class="text-2xs text-zinc-400 truncate" id="uploadStageText">${stage}</div>
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            id="btnTogglePauseUpload"
            class="px-2 py-1 rounded-md text-2xs font-medium ${isPaused ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'} transition cursor-pointer"
            title="${isPaused ? 'Tiếp tục' : 'Tạm dừng'}"
          >
            <i data-lucide="${isPaused ? 'play' : 'pause'}" class="w-3 h-3 inline mr-1"></i>
            <span>${isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
          </button>
          <button
            type="button"
            id="btnCancelUpload"
            class="px-2 py-1 rounded-md text-2xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/25 transition cursor-pointer"
            title="Hủy"
          >
            <i data-lucide="x" class="w-3 h-3 inline mr-0.5"></i>
            <span>Hủy</span>
          </button>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="space-y-1.5">
        <div class="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            id="uploadProgressBarFill"
            class="h-full bg-gradient-to-r ${isPaused ? 'from-amber-500 to-amber-400' : 'from-sky-500 to-indigo-500'} transition-all duration-300"
            style="width: ${percent}%"
          ></div>
        </div>

        <!-- Telemetry Stats -->
        <div class="flex items-center justify-between text-2xs font-mono text-zinc-400 pt-0.5">
          <span class="text-zinc-200 font-semibold" id="uploadProgressPct">${percent}%</span>
          <span id="uploadBytesInfo">${uploaded} / ${total}</span>
          <span class="text-sky-400" id="uploadSpeedInfo"><i data-lucide="gauge" class="w-2.5 h-2.5 inline mr-0.5"></i>${speed}</span>
          <span class="text-zinc-400" id="uploadEtaInfo"><i data-lucide="clock" class="w-2.5 h-2.5 inline mr-0.5"></i>${eta}</span>
        </div>
      </div>
    </div>
  `.trim();
}

export function renderResumeCheckpointBanner(checkpoint) {
  if (!checkpoint?.fileName) return '';
  return `
    <div id="uploadCheckpointBanner" class="p-3.5 rounded-xl bg-sky-950/40 border border-sky-500/30 flex items-center justify-between gap-3 text-xs animate-fadeIn">
      <div class="flex items-center gap-2.5 min-w-0">
        <i data-lucide="alert-circle" class="w-4 h-4 text-sky-400 shrink-0"></i>
        <div class="min-w-0">
          <span class="text-zinc-200 font-medium">Tệp chưa hoàn tất:</span>
          <span class="text-sky-300 font-mono font-semibold truncate block sm:inline"> ${checkpoint.fileName}</span>
          <span class="text-zinc-400 text-2xs block">Chọn lại tệp để tiếp tục</span>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <label for="archiveResumeFileInput" class="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs cursor-pointer shadow-xs transition">
          Tiếp tục
        </label>
        <input type="file" id="archiveResumeFileInput" class="hidden" />
        <button type="button" id="btnDismissCheckpoint" class="p-1 text-zinc-500 hover:text-zinc-300 cursor-pointer" title="Bỏ qua">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `.trim();
}

export function updateUploadProgressUI(t) {
  if (!t) return;
  const fill = document.getElementById('uploadProgressBarFill');
  const pct = document.getElementById('uploadProgressPct');
  const bytes = document.getElementById('uploadBytesInfo');
  const speed = document.getElementById('uploadSpeedInfo');
  const eta = document.getElementById('uploadEtaInfo');

  if (fill) fill.style.width = `${t.percent || 0}%`;
  if (pct) pct.textContent = `${t.percent || 0}%`;
  if (bytes && t.formattedUploaded && t.formattedTotal) {
    bytes.textContent = `${t.formattedUploaded} / ${t.formattedTotal}`;
  }
  if (speed) {
    speed.innerHTML = `<i data-lucide="gauge" class="w-2.5 h-2.5 inline mr-0.5"></i>${t.formattedSpeed || '0 KB/s'}`;
  }
  if (eta) {
    eta.innerHTML = `<i data-lucide="clock" class="w-2.5 h-2.5 inline mr-0.5"></i>${t.formattedEta || '--'}`;
  }
}

export function attachUploadProgressControls({ getUploader, onCancel } = {}) {
  const btnPause = document.getElementById('btnTogglePauseUpload');
  if (btnPause) {
    btnPause.onclick = () => {
      const uploader = typeof getUploader === 'function' ? getUploader() : getUploader;
      if (!uploader) return;
      if (uploader.isPaused) uploader.resume();
      else uploader.pause();
      const isPaused = uploader.isPaused;
      btnPause.title = isPaused ? 'Tiếp tục' : 'Tạm dừng';
      btnPause.innerHTML = `<i data-lucide="${isPaused ? 'play' : 'pause'}" class="w-3 h-3 inline mr-1"></i><span>${isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>`;
      if (window.lucide) window.lucide.createIcons({ root: btnPause });
    };
  }

  const btnCancel = document.getElementById('btnCancelUpload');
  if (btnCancel) {
    btnCancel.onclick = () => {
      if (typeof onCancel === 'function') onCancel();
    };
  }
}

