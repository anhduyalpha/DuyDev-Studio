/**
 * AdminOperationsInspectorModal.js - Dedicated Maintenance Box Deep Inspector
 * Allows inspecting and fine-grained purging across R2 Transit, BullMQ Queues, Trash History, SQLite DB, and Browser Cache.
 */

import { getStorageAuthHeaders } from '../../utilities/adminAuth.js';
import { showToast } from '../../utilities/toast.js';
import { openSlideConfirmModal } from '../common/SlideConfirmModal.js';
import { clearAllModuleStates } from '../../utilities/moduleState.js';

let activeBoxTab = 'r2'; // 'r2' | 'queues' | 'trash' | 'db' | 'cache'
let onModalCloseCallback = null;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i] || 'MB'}`;
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

/**
 * Main export to open the inspector modal on a specific box
 */
export function openOperationsInspectorModal(initialTab = 'r2', onReload = null) {
  activeBoxTab = initialTab;
  onModalCloseCallback = onReload;

  const modalId = 'adminOperationsInspectorModal';
  const oldModal = document.getElementById(modalId);
  if (oldModal) oldModal.remove();

  const modalHtml = `
    <div id="${modalId}" class="fixed inset-0 z-[9992] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div class="relative w-full max-w-4xl max-h-[92vh] rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#111114] p-5 sm:p-6 shadow-2xl flex flex-col space-y-4 overflow-hidden">
        
        <!-- Header -->
        <div class="flex items-start justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0 shadow-inner">
              <i data-lucide="scan" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Trình Soi Chi Tiết Vận Hành (Operations Box Inspector)
              </h3>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Kiểm tra chi tiết từng thực thể trước khi dọn dẹp hoặc khôi phục dữ liệu
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btnCloseOpsInspector"
            class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            title="Đóng modal"
          >
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Tab Selector Bar -->
        <div class="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/5 text-xs font-semibold overflow-x-auto shrink-0">
          <button
            type="button"
            data-box-tab="r2"
            class="btn-ops-tab px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${activeBoxTab === 'r2' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
          >
            <i data-lucide="cloud-off" class="w-3.5 h-3.5"></i>
            <span>R2 Transit Mồ Côi</span>
          </button>
          <button
            type="button"
            data-box-tab="queues"
            class="btn-ops-tab px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${activeBoxTab === 'queues' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
          >
            <i data-lucide="layers" class="w-3.5 h-3.5"></i>
            <span>Hàng Đợi BullMQ</span>
          </button>
          <button
            type="button"
            data-box-tab="trash"
            class="btn-ops-tab px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${activeBoxTab === 'trash' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
          >
            <i data-lucide="archive" class="w-3.5 h-3.5"></i>
            <span>Lịch Sử Thùng Rác</span>
          </button>
          <button
            type="button"
            data-box-tab="db"
            class="btn-ops-tab px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${activeBoxTab === 'db' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
          >
            <i data-lucide="database" class="w-3.5 h-3.5"></i>
            <span>SQLite Database</span>
          </button>
          <button
            type="button"
            data-box-tab="cache"
            class="btn-ops-tab px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${activeBoxTab === 'cache' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
          >
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            <span>Bộ Nhớ Trình Duyệt</span>
          </button>
        </div>

        <!-- Dynamic Content Body -->
        <div id="opsInspectorBody" class="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[350px]">
          <div class="py-16 text-center text-zinc-500 text-xs font-mono">
            <span class="inline-block animate-spin mr-2">⟳</span> Đang tải dữ liệu...
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  if (window.lucide) window.lucide.createIcons();

  const modalEl = document.getElementById(modalId);
  const close = () => {
    if (modalEl) modalEl.remove();
    if (onModalCloseCallback) onModalCloseCallback();
  };

  modalEl.querySelector('#btnCloseOpsInspector').onclick = close;

  // Tab switching
  const tabButtons = modalEl.querySelectorAll('.btn-ops-tab');
  tabButtons.forEach(btn => {
    btn.onclick = () => {
      activeBoxTab = btn.dataset.boxTab;
      tabButtons.forEach(b => {
        const isCurrent = b.dataset.boxTab === activeBoxTab;
        b.className = `btn-ops-tab px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${isCurrent ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`;
      });
      loadActiveTabContent(modalEl);
    };
  });

  loadActiveTabContent(modalEl);
}

/**
 * Loads and renders the specific content for the active tab
 */
async function loadActiveTabContent(modalEl) {
  const bodyEl = modalEl.querySelector('#opsInspectorBody');
  if (!bodyEl) return;

  bodyEl.innerHTML = `
    <div class="py-16 text-center text-zinc-500 text-xs font-mono">
      <span class="inline-block animate-spin mr-2">⟳</span> Đang tải thông tin...
    </div>
  `;

  try {
    if (activeBoxTab === 'r2') {
      await renderR2TransitTab(bodyEl, modalEl);
    } else if (activeBoxTab === 'queues') {
      await renderBullMqQueuesTab(bodyEl, modalEl);
    } else if (activeBoxTab === 'trash') {
      await renderTrashHistoryTab(bodyEl, modalEl);
    } else if (activeBoxTab === 'db') {
      await renderSqliteDbTab(bodyEl, modalEl);
    } else if (activeBoxTab === 'cache') {
      renderBrowserCacheTab(bodyEl, modalEl);
    }
  } catch (err) {
    bodyEl.innerHTML = `
      <div class="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs space-y-2">
        <p class="font-bold">Lỗi khi tải thông tin bảo trì:</p>
        <p class="font-mono">${escapeHtml(err.message)}</p>
      </div>
    `;
  }

  if (window.lucide) window.lucide.createIcons();
}

/**
 * TAB 1: R2 Transit
 */
async function renderR2TransitTab(bodyEl, modalEl) {
  const resp = await fetch('/api/v1/admin/actions/inspect-r2', {
    headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
  });
  const json = await resp.json();
  const data = json.data || {};
  const objects = data.objects || [];

  bodyEl.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-white/5 text-xs font-mono">
      <div>
        <span class="text-zinc-500">Cloudflare R2 Transit: </span>
        <strong class="text-zinc-200">${data.totalCount || 0} tệp mồ côi</strong>
        <span class="text-zinc-500"> (${data.totalSizeFormatted || '0 B'})</span>
      </div>
      <button
        type="button"
        id="btnPurgeAllR2Transit"
        class="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold transition cursor-pointer flex items-center gap-1.5"
      >
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        <span>Dọn Sạch R2 Transit</span>
      </button>
    </div>

    ${objects.length === 0 ? `
      <div class="py-16 text-center text-zinc-500 text-xs">
        <i data-lucide="shield-check" class="w-10 h-10 mx-auto mb-2 text-emerald-500"></i>
        <p class="font-bold text-zinc-300">Không có tệp transit mồ côi nào trên Cloudflare R2</p>
        <p class="text-zinc-500 mt-0.5">Bucket sạch sẽ, không có tệp tải dở nào bị kẹt lại.</p>
      </div>
    ` : `
      <div class="space-y-2">
        ${objects.map(obj => `
          <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5 flex items-center justify-between gap-3 text-xs font-mono">
            <div class="truncate flex items-center gap-2">
              <i data-lucide="file" class="w-4 h-4 text-orange-400 shrink-0"></i>
              <div class="truncate">
                <span class="text-zinc-200 font-bold truncate block" title="${escapeHtml(obj.key)}">${escapeHtml(obj.key)}</span>
                <span class="text-zinc-500 text-[11px]">${obj.sizeFormatted} · ${formatRelativeTime(obj.lastModified)} · Account: ${obj.target}</span>
              </div>
            </div>
            <button
              type="button"
              class="btn-delete-r2-obj px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] cursor-pointer transition shrink-0"
              data-key="${escapeHtml(obj.key)}"
            >
              Xóa
            </button>
          </div>
        `).join('')}
      </div>
    `}
  `;

  // Delete individual R2 object
  bodyEl.querySelectorAll('.btn-delete-r2-obj').forEach(btn => {
    btn.onclick = async () => {
      const key = btn.dataset.key;
      btn.disabled = true;
      btn.textContent = 'Đang xóa...';
      try {
        const delResp = await fetch('/api/v1/admin/actions/delete-r2-object', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() },
          body: JSON.stringify({ key })
        });
        const delJson = await delResp.json();
        if (delJson.success) {
          showToast(`Đã xóa object ${key}`, 'success');
          loadActiveTabContent(modalEl);
        } else {
          showToast(`Lỗi: ${delJson.message}`, 'error');
          btn.disabled = false;
          btn.textContent = 'Xóa';
        }
      } catch (err) {
        showToast(`Lỗi mạng: ${err.message}`, 'error');
      }
    };
  });

  // Purge all R2 transit with Slide-To-Confirm
  const btnPurgeAll = bodyEl.querySelector('#btnPurgeAllR2Transit');
  if (btnPurgeAll) {
    btnPurgeAll.onclick = () => {
      openSlideConfirmModal({
        title: 'Dọn Sạch Toàn Bộ R2 Transit Mồ Côi',
        description: `Xóa toàn bộ các tệp tải dở hoặc chưa commit đang lưu trên Cloudflare R2 bucket (${objects.length} tệp).`,
        warningText: 'Các tệp này sẽ bị xóa vĩnh viễn khỏi Cloudflare R2 bucket.',
        actionText: 'Kéo sang phải để dọn sạch R2 Transit',
        confirmingText: 'Đang dọn sạch Cloudflare R2...',
        onConfirm: async () => {
          try {
            const cleanResp = await fetch('/api/v1/admin/actions/clean-r2', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() }
            });
            const cleanJson = await cleanResp.json();
            showToast(cleanJson.message || 'Đã dọn sạch R2 transit', 'success');
            loadActiveTabContent(modalEl);
          } catch (err) {
            showToast(`Lỗi khi dọn dẹp: ${err.message}`, 'error');
          }
        }
      });
    };
  }
}

/**
 * TAB 2: BullMQ Queues
 */
async function renderBullMqQueuesTab(bodyEl, modalEl) {
  const resp = await fetch('/api/v1/admin/actions/inspect-queues', {
    headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
  });
  const json = await resp.json();
  const data = json.data || {};
  const jobs = data.jobs || [];

  bodyEl.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-white/5 text-xs font-mono">
      <div>
        <span class="text-zinc-500">BullMQ Queues: </span>
        <strong class="text-zinc-200">${data.totalCount || 0} tác vụ đang lưu trữ</strong>
        <span class="text-zinc-500"> (PDF: ${data.countsByQueue?.pdf || 0}, Converter: ${data.countsByQueue?.converter || 0}, Quiz: ${data.countsByQueue?.quiz || 0})</span>
      </div>
      <button
        type="button"
        id="btnPurgeAllQueues"
        class="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold transition cursor-pointer flex items-center gap-1.5"
      >
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        <span>Dọn Sạch Hàng Đợi</span>
      </button>
    </div>

    ${jobs.length === 0 ? `
      <div class="py-16 text-center text-zinc-500 text-xs">
        <i data-lucide="check-circle" class="w-10 h-10 mx-auto mb-2 text-emerald-500"></i>
        <p class="font-bold text-zinc-300">Không có job nào đang tồn tại trong các hàng đợi</p>
        <p class="text-zinc-500 mt-0.5">Tất cả hàng đợi BullMQ trống hoặc đã được dọn sạch.</p>
      </div>
    ` : `
      <div class="space-y-2">
        ${jobs.map(job => {
          let statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300">${job.status}</span>`;
          if (job.status === 'completed') statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">COMPLETED</span>`;
          else if (job.status === 'failed') statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">FAILED</span>`;
          else if (job.status === 'active') statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">ACTIVE</span>`;

          return `
            <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5 flex items-center justify-between gap-3 text-xs font-mono">
              <div class="truncate">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-zinc-200">${escapeHtml(job.queueLabel)}: #${escapeHtml(job.id)}</span>
                  ${statusBadge}
                </div>
                <div class="text-zinc-500 text-[11px] mt-0.5 truncate">
                  Tên: ${escapeHtml(job.name)} · ${formatRelativeTime(job.timestamp)}
                  ${job.failedReason ? ` · <span class="text-rose-400 font-bold">${escapeHtml(job.failedReason)}</span>` : ''}
                </div>
              </div>
              <button
                type="button"
                class="btn-delete-queue-job px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] cursor-pointer transition shrink-0"
                data-queue="${escapeHtml(job.queueName)}"
                data-id="${escapeHtml(job.id)}"
              >
                Xóa Job
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  // Delete individual job
  bodyEl.querySelectorAll('.btn-delete-queue-job').forEach(btn => {
    btn.onclick = async () => {
      const queueName = btn.dataset.queue;
      const jobId = btn.dataset.id;
      btn.disabled = true;
      btn.textContent = 'Đang xóa...';
      try {
        const delResp = await fetch('/api/v1/admin/actions/delete-queue-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() },
          body: JSON.stringify({ queueName, jobId })
        });
        const delJson = await delResp.json();
        if (delJson.success) {
          showToast(`Đã xóa job ${jobId} khỏi ${queueName}`, 'success');
          loadActiveTabContent(modalEl);
        } else {
          showToast(`Lỗi: ${delJson.message}`, 'error');
          btn.disabled = false;
          btn.textContent = 'Xóa Job';
        }
      } catch (err) {
        showToast(`Lỗi mạng: ${err.message}`, 'error');
      }
    };
  });

  // Purge all queues with Slide-To-Confirm
  const btnPurgeAll = bodyEl.querySelector('#btnPurgeAllQueues');
  if (btnPurgeAll) {
    btnPurgeAll.onclick = () => {
      openSlideConfirmModal({
        title: 'Dọn Sạch Toàn Bộ Hàng Đợi BullMQ',
        description: 'Xóa sạch tất cả các job đã hoàn thành hoặc thất bại trong Redis queues.',
        warningText: 'Các tác vụ cũ sẽ bị xóa khỏi Redis và không thể truy vết lại trong hàng đợi.',
        actionText: 'Kéo sang phải để dọn sạch queues',
        confirmingText: 'Đang dọn dẹp Redis queues...',
        onConfirm: async () => {
          try {
            const cleanResp = await fetch('/api/v1/admin/actions/clean-queues', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() }
            });
            const cleanJson = await cleanResp.json();
            showToast(cleanJson.message || 'Đã dọn sạch hàng đợi', 'success');
            loadActiveTabContent(modalEl);
          } catch (err) {
            showToast(`Lỗi khi dọn dẹp: ${err.message}`, 'error');
          }
        }
      });
    };
  }
}

/**
 * TAB 3: Trash History
 */
async function renderTrashHistoryTab(bodyEl, modalEl) {
  const resp = await fetch('/api/v1/admin/actions/inspect-trash', {
    headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
  });
  const json = await resp.json();
  const data = json.data || {};
  const records = data.records || [];

  bodyEl.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-white/5 text-xs font-mono">
      <div>
        <span class="text-zinc-500">Lịch Sử Thùng Rác (Trash): </span>
        <strong class="text-zinc-200">${data.totalCount || 0} bản ghi đã xóa tạm</strong>
      </div>
      <button
        type="button"
        id="btnPurgeAllTrash"
        class="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold transition cursor-pointer flex items-center gap-1.5"
      >
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        <span>Dọn Sạch Thùng Rác</span>
      </button>
    </div>

    ${records.length === 0 ? `
      <div class="py-16 text-center text-zinc-500 text-xs">
        <i data-lucide="inbox" class="w-10 h-10 mx-auto mb-2 text-zinc-500"></i>
        <p class="font-bold text-zinc-300">Thùng rác hiện đang trống</p>
        <p class="text-zinc-500 mt-0.5">Không có bản ghi lịch sử xử lý nào đang nằm trong thùng rác.</p>
      </div>
    ` : `
      <div class="space-y-2">
        ${records.map(r => `
          <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5 flex items-center justify-between gap-3 text-xs font-mono">
            <div class="truncate">
              <div class="flex items-center gap-2">
                <span class="font-bold text-zinc-200 truncate" title="${escapeHtml(r.fileName)}">${escapeHtml(r.fileName)}</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400">${escapeHtml(r.toolTitle || r.toolId)}</span>
              </div>
              <div class="text-zinc-500 text-[11px] mt-0.5">
                Kích thước: ${formatBytes(r.resultSize || r.originalSize)} · Đã xóa: ${formatRelativeTime(r.deletedAt)}
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                class="btn-restore-trash px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] cursor-pointer transition"
                data-id="${escapeHtml(r.id)}"
              >
                Khôi phục
              </button>
              <button
                type="button"
                class="btn-delete-trash-perm px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] cursor-pointer transition"
                data-id="${escapeHtml(r.id)}"
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;

  // Restore record
  bodyEl.querySelectorAll('.btn-restore-trash').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      try {
        const rResp = await fetch('/api/v1/admin/actions/restore-trash-record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() },
          body: JSON.stringify({ id })
        });
        const rJson = await rResp.json();
        if (rJson.success) {
          showToast(`Đã khôi phục bản ghi`, 'success');
          loadActiveTabContent(modalEl);
        } else {
          showToast(`Lỗi: ${rJson.message}`, 'error');
        }
      } catch (err) {
        showToast(`Lỗi mạng: ${err.message}`, 'error');
      }
    };
  });

  // Permanently delete record
  bodyEl.querySelectorAll('.btn-delete-trash-perm').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      try {
        const dResp = await fetch('/api/v1/admin/actions/delete-trash-record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() },
          body: JSON.stringify({ id })
        });
        const dJson = await dResp.json();
        if (dJson.success) {
          showToast(`Đã xóa vĩnh viễn bản ghi`, 'success');
          loadActiveTabContent(modalEl);
        } else {
          showToast(`Lỗi: ${dJson.message}`, 'error');
        }
      } catch (err) {
        showToast(`Lỗi mạng: ${err.message}`, 'error');
      }
    };
  });

  // Purge all trash
  const btnPurgeAll = bodyEl.querySelector('#btnPurgeAllTrash');
  if (btnPurgeAll) {
    btnPurgeAll.onclick = () => {
      openSlideConfirmModal({
        title: 'Dọn Sạch Thùng Rác Hệ Thống',
        description: `Xóa vĩnh viễn toàn bộ ${records.length} bản ghi lịch sử trong thùng rác.`,
        warningText: 'Thao tác này sẽ xóa vĩnh viễn và không thể khôi phục.',
        actionText: 'Kéo sang phải để dọn sạch thùng rác',
        confirmingText: 'Đang dọn thùng rác...',
        onConfirm: async () => {
          try {
            const cleanResp = await fetch('/api/v1/admin/actions/clean-history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() }
            });
            const cleanJson = await cleanResp.json();
            showToast(cleanJson.message || 'Đã dọn sạch thùng rác', 'success');
            loadActiveTabContent(modalEl);
          } catch (err) {
            showToast(`Lỗi khi dọn dẹp: ${err.message}`, 'error');
          }
        }
      });
    };
  }
}

/**
 * TAB 4: SQLite Database
 */
async function renderSqliteDbTab(bodyEl, modalEl) {
  const resp = await fetch('/api/v1/admin/actions/inspect-db', {
    headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
  });
  const json = await resp.json();
  const data = json.data || {};
  const files = data.files || [];
  const tables = data.tables || {};
  const pragma = data.pragma || {};

  bodyEl.innerHTML = `
    <!-- Top Summary Banner -->
    <div class="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-white/5 text-xs font-mono">
      <div>
        <span class="text-zinc-500">SQLite Database: </span>
        <strong class="text-emerald-400 font-bold">${data.totalSizeFormatted || '0 MB'}</strong>
        <span class="text-zinc-500"> · Chế độ WAL: </span><strong class="text-zinc-200 uppercase">${pragma.journalMode || 'wal'}</strong>
      </div>
      <button
        type="button"
        id="btnOptimizeDbNow"
        class="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-semibold transition cursor-pointer flex items-center gap-1.5"
      >
        <i data-lucide="database" class="w-3.5 h-3.5"></i>
        <span>Tối Ưu & Truncate WAL</span>
      </button>
    </div>

    <!-- DB Files Breakdown -->
    <div>
      <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-2">
        <i data-lucide="hard-drive" class="w-3.5 h-3.5 text-orange-400"></i>
        Tệp Tin Cơ Sở Dữ Liệu Trên Đĩa
      </h4>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        ${files.map(f => `
          <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5 font-mono text-xs">
            <span class="text-zinc-500 block text-[11px]">${f.name}</span>
            <span class="text-sm font-bold text-zinc-200 block mt-0.5">${f.sizeFormatted}</span>
            <span class="text-[10px] text-zinc-500 truncate block mt-0.5">${f.exists ? 'Đang hoạt động' : 'Không tồn tại'}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- DB Tables Row Count -->
    <div>
      <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-2">
        <i data-lucide="table" class="w-3.5 h-3.5 text-cyan-400"></i>
        Số Lượng Bản Ghi Các Bảng Dữ Liệu
      </h4>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
        <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5">
          <span class="text-zinc-500 text-[11px] block">jobs</span>
          <span class="text-base font-bold text-zinc-200">${(tables.jobs || 0).toLocaleString()}</span>
        </div>
        <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5">
          <span class="text-zinc-500 text-[11px] block">files</span>
          <span class="text-base font-bold text-zinc-200">${(tables.files || 0).toLocaleString()}</span>
        </div>
        <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5">
          <span class="text-zinc-500 text-[11px] block">history_records</span>
          <span class="text-base font-bold text-zinc-200">${(tables.historyRecords || 0).toLocaleString()}</span>
        </div>
        <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5">
          <span class="text-zinc-500 text-[11px] block">dynamic_qrs</span>
          <span class="text-base font-bold text-zinc-200">${(tables.dynamicQrs || 0).toLocaleString()}</span>
        </div>
        <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5">
          <span class="text-zinc-500 text-[11px] block">qr_scan_logs</span>
          <span class="text-base font-bold text-zinc-200">${(tables.qrScanLogs || 0).toLocaleString()}</span>
        </div>
        <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5">
          <span class="text-zinc-500 text-[11px] block">users</span>
          <span class="text-base font-bold text-zinc-200">${(tables.users || 0).toLocaleString()}</span>
        </div>
      </div>
    </div>

    <!-- PRAGMA Status -->
    <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5 text-xs font-mono">
      <div class="text-zinc-500 text-[11px] mb-1">Trạng thái PRAGMA nội bộ:</div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-zinc-300">
        <div>Page size: <strong class="text-zinc-100">${pragma.pageSize || 4096} B</strong></div>
        <div>Page count: <strong class="text-zinc-100">${pragma.pageCount || 0}</strong></div>
        <div>Freelist count: <strong class="text-zinc-100">${pragma.freelistCount || 0}</strong></div>
        <div>Journal mode: <strong class="text-emerald-400 uppercase">${pragma.journalMode || 'wal'}</strong></div>
      </div>
    </div>
  `;

  // Optimize DB with Slide-To-Confirm
  const btnOptimize = bodyEl.querySelector('#btnOptimizeDbNow');
  if (btnOptimize) {
    btnOptimize.onclick = () => {
      openSlideConfirmModal({
        title: 'Tối Ưu Hóa & Thu Gọn SQLite DB',
        description: 'Chạy PRAGMA wal_checkpoint(TRUNCATE) để giải phóng file dev.db-wal và dọn dẹp các trang bộ nhớ rác.',
        warningText: 'Quá trình có thể khóa SQLite tạm thời trong vài mili-giây.',
        actionText: 'Kéo sang phải để tối ưu hóa database',
        confirmingText: 'Đang tối ưu SQLite...',
        onConfirm: async () => {
          try {
            const optResp = await fetch('/api/v1/admin/actions/optimize-db', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() }
            });
            const optJson = await optResp.json();
            showToast(optJson.message || 'Đã tối ưu database', 'success');
            loadActiveTabContent(modalEl);
          } catch (err) {
            showToast(`Lỗi khi tối ưu: ${err.message}`, 'error');
          }
        }
      });
    };
  }
}

/**
 * TAB 5: Browser Cache & Module States
 */
function renderBrowserCacheTab(bodyEl, modalEl) {
  const localKeys = [];
  let totalBytes = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const val = localStorage.getItem(key) || '';
      const bytes = (key.length + val.length) * 2; // rough UTF-16 byte size
      totalBytes += bytes;
      localKeys.push({ key, sizeBytes: bytes, preview: val.slice(0, 80) });
    }
  }

  bodyEl.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-white/5 text-xs font-mono">
      <div>
        <span class="text-zinc-500">Bộ nhớ Trình duyệt (localStorage): </span>
        <strong class="text-zinc-200">${localKeys.length} khóa lưu trữ</strong>
        <span class="text-zinc-500"> (${formatBytes(totalBytes)})</span>
      </div>
      <button
        type="button"
        id="btnWipeAllCache"
        class="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold transition cursor-pointer flex items-center gap-1.5"
      >
        <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
        <span>Xóa Toàn Bộ Bộ Nhớ Trình Duyệt</span>
      </button>
    </div>

    ${localKeys.length === 0 ? `
      <div class="py-16 text-center text-zinc-500 text-xs">
        <i data-lucide="check-circle" class="w-10 h-10 mx-auto mb-2 text-emerald-500"></i>
        <p class="font-bold text-zinc-300">Không có khóa dữ liệu nào trong localStorage</p>
      </div>
    ` : `
      <div class="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        ${localKeys.map(k => `
          <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5 flex items-center justify-between gap-3 text-xs font-mono">
            <div class="truncate">
              <div class="font-bold text-zinc-200 truncate" title="${escapeHtml(k.key)}">${escapeHtml(k.key)}</div>
              <div class="text-zinc-500 text-[11px] truncate mt-0.5">
                ${formatBytes(k.sizeBytes)} · <span class="text-zinc-400">${escapeHtml(k.preview)}</span>
              </div>
            </div>
            <button
              type="button"
              class="btn-delete-cache-key px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] cursor-pointer transition shrink-0"
              data-key="${escapeHtml(k.key)}"
            >
              Xóa
            </button>
          </div>
        `).join('')}
      </div>
    `}
  `;

  // Delete individual key
  bodyEl.querySelectorAll('.btn-delete-cache-key').forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.key;
      localStorage.removeItem(key);
      showToast(`Đã xóa khóa ${key}`, 'info');
      loadActiveTabContent(modalEl);
    };
  });

  // Wipe all cache
  const btnWipe = bodyEl.querySelector('#btnWipeAllCache');
  if (btnWipe) {
    btnWipe.onclick = () => {
      openSlideConfirmModal({
        title: 'Đặt Lại Toàn Bộ Bộ Nhớ Trình Duyệt',
        description: 'Xóa sạch tất cả các bản nháp, trạng thái module và cache của DuyDev Studio lưu trên máy tính của bạn.',
        warningText: 'Các bản nháp chưa tải xuống sẽ bị mất.',
        actionText: 'Kéo sang phải để xóa bộ nhớ trình duyệt',
        confirmingText: 'Đang xóa bộ nhớ trình duyệt...',
        onConfirm: async () => {
          clearAllModuleStates();
          localStorage.clear();
          sessionStorage.clear();
          showToast('Đã đặt lại toàn bộ bộ nhớ trình duyệt', 'success');
          loadActiveTabContent(modalEl);
        }
      });
    };
  }
}
