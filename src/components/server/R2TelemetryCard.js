/**
 * R2TelemetryCard.js - Cloudflare R2 Transit & Quota Telemetry Component
 * Displays real-time Class A/B request usage, Circuit Breaker quota, and live S3 bucket storage.
 * Follows UI Production Minimalism (Linear/Vercel utility aesthetic).
 */

import { getStorageAuthHeaders } from '../../utilities/adminAuth.js';
import { showToast } from '../../utilities/toast.js';

export function renderR2TelemetryCard() {
  return `
    <div class="p-4 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/80 dark:border-white/[0.06] space-y-3.5">
      <!-- Header -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <i data-lucide="cloud-lightning" class="w-4 h-4 text-amber-500 shrink-0"></i>
          <span class="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">Cloudflare R2 Transit & Quota</span>
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">TRANSIT PIPE</span>
        </div>
        <button 
          id="btnRefreshR2Stats" 
          class="px-2.5 py-1 rounded-lg text-xs font-mono bg-white dark:bg-white/[0.05] hover:bg-zinc-100 dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          title="Cập nhật số liệu"
        >
          <i data-lucide="refresh-cw" class="w-3 h-3 text-zinc-500" id="iconR2Refresh"></i>
          <span>Làm mới</span>
        </button>
      </div>

      <!-- 3 Metrics Tiles -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div class="p-3 rounded-lg bg-white dark:bg-black/20 border border-zinc-200/60 dark:border-white/[0.04]">
          <span class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Class A (PUT / LIST)</span>
          <div class="flex items-baseline gap-1.5 mt-1">
            <span id="r2ClassACount" class="font-mono text-base font-bold text-zinc-900 dark:text-white">--</span>
            <span class="text-[11px] font-mono text-zinc-400">/ 1M free</span>
          </div>
        </div>

        <div class="p-3 rounded-lg bg-white dark:bg-black/20 border border-zinc-200/60 dark:border-white/[0.04]">
          <span class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Class B (GET)</span>
          <div class="flex items-baseline gap-1.5 mt-1">
            <span id="r2ClassBCount" class="font-mono text-base font-bold text-zinc-900 dark:text-white">--</span>
            <span class="text-[11px] font-mono text-zinc-400">/ 10M free</span>
          </div>
        </div>

        <div class="p-3 rounded-lg bg-white dark:bg-black/20 border border-zinc-200/60 dark:border-white/[0.04]">
          <span class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Circuit Breaker</span>
          <div class="flex items-baseline gap-1.5 mt-1">
            <span id="r2PercentUsed" class="font-mono text-base font-bold text-emerald-500">--%</span>
            <span id="r2RemainingCount" class="text-[11px] font-mono text-zinc-400">còn -- lượt</span>
          </div>
        </div>
      </div>

      <!-- Quota Progress Bar -->
      <div class="space-y-1">
        <div class="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden">
          <div id="r2QuotaProgressBar" class="h-full bg-emerald-500 rounded-full transition-all duration-300" style="width: 0%"></div>
        </div>
        <div class="flex items-center justify-between text-[10px] font-mono text-zinc-500">
          <span id="r2MonthLabel">Tháng --</span>
          <span id="r2QuotaCapLabel">Hạn mức: 900,000 / tháng</span>
        </div>
      </div>

      <!-- Live Bucket Storage Strip -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-black/20 border border-zinc-200/60 dark:border-white/[0.04] text-xs font-mono">
        <div class="flex items-center gap-2">
          <i data-lucide="database" class="w-3.5 h-3.5 text-indigo-500 shrink-0"></i>
          <span class="text-zinc-500">Bucket:</span>
          <span id="r2BucketName" class="font-bold text-zinc-800 dark:text-zinc-200">ddstudio-backend</span>
          <span id="r2StorageStatusBadge" class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
            0 TỆP TỒN ĐỌNG
          </span>
        </div>
        <div class="flex items-center gap-1.5 text-zinc-500">
          <span>Lưu trữ:</span>
          <span id="r2StorageSize" class="font-bold text-zinc-900 dark:text-white">0.00 MB</span>
          <span class="text-zinc-400">/ 10 GB Free</span>
        </div>
      </div>
    </div>
  `;
}

export function attachR2TelemetryListeners() {
  const btnRefresh = document.getElementById('btnRefreshR2Stats');
  const iconRefresh = document.getElementById('iconR2Refresh');

  const updateDom = (data) => {
    const elClassA = document.getElementById('r2ClassACount');
    const elClassB = document.getElementById('r2ClassBCount');
    const elPercent = document.getElementById('r2PercentUsed');
    const elRemaining = document.getElementById('r2RemainingCount');
    const elBar = document.getElementById('r2QuotaProgressBar');
    const elMonth = document.getElementById('r2MonthLabel');
    const elCap = document.getElementById('r2QuotaCapLabel');
    const elBucket = document.getElementById('r2BucketName');
    const elBadge = document.getElementById('r2StorageStatusBadge');
    const elSize = document.getElementById('r2StorageSize');

    if (elClassA) elClassA.textContent = Number(data.classA || 0).toLocaleString();
    if (elClassB) elClassB.textContent = Number(data.classB || 0).toLocaleString();
    if (elPercent) {
      elPercent.textContent = `${data.percentUsed || 0}%`;
      if (data.percentUsed > 80) {
        elPercent.className = 'font-mono text-base font-bold text-rose-500';
      } else if (data.percentUsed > 50) {
        elPercent.className = 'font-mono text-base font-bold text-amber-500';
      } else {
        elPercent.className = 'font-mono text-base font-bold text-emerald-500';
      }
    }
    if (elRemaining) elRemaining.textContent = `còn ${Number(data.remainingRequests || 0).toLocaleString()} lượt`;
    if (elBar) {
      const pct = Math.min(100, Math.max(0, data.percentUsed || 0));
      elBar.style.width = `${pct}%`;
      elBar.className = `h-full rounded-full transition-all duration-300 ${
        pct > 80 ? 'bg-rose-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
      }`;
    }
    if (elMonth) elMonth.textContent = `Tháng ${data.month || ''}`;
    if (elCap) elCap.textContent = `Hạn mức: ${Number(data.maxMonthlyRequests || 900000).toLocaleString()} / tháng`;
    if (elBucket && data.bucketName) elBucket.textContent = data.bucketName;

    if (data.liveStorage) {
      const count = data.liveStorage.objectCount || 0;
      const mb = data.liveStorage.totalMb || 0;
      if (elBadge) {
        if (count === 0) {
          elBadge.textContent = '0 TỆP TỒN ĐỌNG';
          elBadge.className = 'px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold';
        } else {
          elBadge.textContent = `${count} TỆP TRANSIT`;
          elBadge.className = 'px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold';
        }
      }
      if (elSize) elSize.textContent = `${mb} MB`;
    }
  };

  const fetchStats = async (isManual = false) => {
    if (iconRefresh) iconRefresh.classList.add('animate-spin');
    if (btnRefresh) btnRefresh.disabled = true;

    try {
      const res = await fetch('/api/v1/admin/r2-stats', {
        headers: {
          ...getStorageAuthHeaders()
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        updateDom(json.data);
        if (isManual) {
          showToast('Đã cập nhật số liệu Cloudflare R2', 'success');
        }
      }
    } catch (err) {
      console.warn('[R2Telemetry] Failed to load stats:', err);
      if (isManual) {
        showToast('Không thể tải dữ liệu R2: ' + (err.message || 'Lỗi mạng'), 'error');
      }
    } finally {
      if (iconRefresh) iconRefresh.classList.remove('animate-spin');
      if (btnRefresh) btnRefresh.disabled = false;
    }
  };

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => fetchStats(true));
  }

  // Fetch initial telemetry
  fetchStats(false);
}
