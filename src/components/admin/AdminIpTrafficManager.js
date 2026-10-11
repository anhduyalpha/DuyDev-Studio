/**
 * AdminIpTrafficManager.js - User & Client IP Traffic Manager (#admin tab 2)
 * Live per-client IP telemetry table, device detection, country badges, bandwidth stats, and per-IP request stream drawer.
 */

import { getStorageAuthHeaders } from '../../utilities/adminAuth.js';
import { showToast } from '../../utilities/toast.js';

let cachedClients = [];
let activeFilter = 'all'; // 'all' | 'lan' | 'wan' | 'errors'
let currentSearch = '';
let activeInspectedIp = null;
let pollTimer = null;

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
  if (!isoString) return '--';
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

function getCountryFlag(countryCode) {
  if (!countryCode || countryCode === 'LAN') return '🏠';
  if (countryCode === 'VN') return '🇻🇳';
  if (countryCode === 'US') return '🇺🇸';
  if (countryCode === 'SG') return '🇸🇬';
  if (countryCode === 'JP') return '🇯🇵';
  if (countryCode === 'KR') return '🇰🇷';
  return '🌐';
}

/**
 * Renders the User & IP Traffic Manager markup
 */
export function renderIpTrafficManager() {
  return `
    <div id="adminIpTrafficContainer" class="space-y-6">
      <!-- Top Card: Summary & Controls -->
      <div class="p-6 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 backdrop-blur-xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-sky-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <i data-lucide="users" class="w-5 h-5"></i>
          </div>
          <div>
            <h2 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Quản Lý Người Dùng & Lưu Lượng Từng IP
              <span id="ipClientsCountBadge" class="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                0 clients
              </span>
            </h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Theo dõi thời gian thực các thiết bị, định vị IP qua Cloudflare và xem luồng request độc lập
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            id="btnRefreshIpClients"
            class="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold border border-zinc-200 dark:border-white/5 transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
          >
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      <!-- Filters & Search Bar -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <!-- Filter Pills -->
        <div class="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/5 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            data-ip-filter="all"
            class="btn-ip-filter px-3 py-1.5 rounded-xl transition cursor-pointer ${activeFilter === 'all' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
          >
            Tất cả
          </button>
          <button
            type="button"
            data-ip-filter="lan"
            class="btn-ip-filter px-3 py-1.5 rounded-xl transition cursor-pointer ${activeFilter === 'lan' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
          >
            Mạng Nội Bộ (LAN)
          </button>
          <button
            type="button"
            data-ip-filter="wan"
            class="btn-ip-filter px-3 py-1.5 rounded-xl transition cursor-pointer ${activeFilter === 'wan' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
          >
            Internet (WAN)
          </button>
          <button
            type="button"
            data-ip-filter="errors"
            class="btn-ip-filter px-3 py-1.5 rounded-xl transition cursor-pointer ${activeFilter === 'errors' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
          >
            Có Lỗi (4xx/5xx)
          </button>
        </div>

        <!-- Search Input -->
        <div class="relative w-full sm:w-72">
          <input
            type="text"
            id="inputSearchIpClients"
            placeholder="Tìm theo IP, quốc gia hoặc thiết bị..."
            value="${escapeHtml(currentSearch)}"
            class="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 font-mono shadow-xs"
          />
          <i data-lucide="search" class="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
        </div>
      </div>

      <!-- IP Clients Table Card -->
      <div class="rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 backdrop-blur-xl shadow-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-zinc-50 dark:bg-zinc-950/60 text-zinc-500 dark:text-zinc-400 font-mono text-[11px] border-b border-zinc-200 dark:border-white/5">
              <tr>
                <th class="px-4 py-3">Địa Chỉ IP & Quốc Gia</th>
                <th class="px-4 py-3">Phân Loại</th>
                <th class="px-4 py-3">Thiết Bị / User-Agent</th>
                <th class="px-4 py-3 text-right">Tổng Requests</th>
                <th class="px-4 py-3 text-right">Băng Thông (In / Out)</th>
                <th class="px-4 py-3 text-center">Trạng Thái (2xx/4xx/5xx)</th>
                <th class="px-4 py-3">Hoạt Động Gần Nhất</th>
                <th class="px-4 py-3 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody id="ipClientsTableBody" class="divide-y divide-zinc-100 dark:divide-white/5 text-zinc-800 dark:text-zinc-200 font-mono">
              <tr>
                <td colspan="8" class="px-4 py-16 text-center text-zinc-500 font-sans">
                  <span class="inline-block animate-spin mr-2">⟳</span> Đang nạp danh sách lưu lượng IP...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/**
 * Filters and renders rows in the IP clients table
 */
function renderIpTableRows(clients) {
  if (!clients || clients.length === 0) {
    return `
      <tr>
        <td colspan="8" class="px-4 py-16 text-center text-zinc-500 font-sans">
          <div class="max-w-xs mx-auto space-y-1">
            <p class="font-bold text-zinc-400">Không tìm thấy địa chỉ IP nào phù hợp</p>
            <p class="text-xs text-zinc-500">Hãy thử xóa bộ lọc tìm kiếm hoặc làm mới trang.</p>
          </div>
        </td>
      </tr>
    `;
  }

  return clients.map(c => {
    const isLan = c.isLan;
    const countryFlag = getCountryFlag(c.country);
    const countryLabel = c.country || (isLan ? 'LAN' : 'VN');

    const typeBadge = isLan
      ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Mạng LAN</span>`
      : `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">WAN Cloudflare</span>`;

    const totalErrors = (c.status4xx || 0) + (c.status5xx || 0);
    const statusCodesMarkup = `
      <div class="inline-flex items-center gap-1.5 text-[11px]">
        <span class="text-emerald-500 font-bold" title="2xx OK">${c.status2xx || 0}</span>
        <span class="text-zinc-400">/</span>
        <span class="${c.status4xx > 0 ? 'text-amber-500 font-bold' : 'text-zinc-500'}" title="4xx Client Error">${c.status4xx || 0}</span>
        <span class="text-zinc-400">/</span>
        <span class="${c.status5xx > 0 ? 'text-rose-500 font-bold' : 'text-zinc-500'}" title="5xx Server Error">${c.status5xx || 0}</span>
      </div>
    `;

    return `
      <tr class="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition">
        <td class="px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="text-base select-none" title="${escapeHtml(countryLabel)}">${countryFlag}</span>
            <div>
              <span class="font-bold text-zinc-900 dark:text-zinc-100 block">${escapeHtml(c.ip)}</span>
              <span class="text-[10px] text-zinc-500 font-sans">${escapeHtml(countryLabel)}</span>
            </div>
          </div>
        </td>

        <td class="px-4 py-3">
          ${typeBadge}
        </td>

        <td class="px-4 py-3 font-sans text-xs">
          <div class="truncate max-w-[220px]" title="${escapeHtml(c.userAgent)}">
            <span class="text-zinc-800 dark:text-zinc-200 font-medium block truncate">${escapeHtml(c.deviceSummary || 'Unknown Device')}</span>
            <span class="text-[10px] text-zinc-500 truncate block mt-0.5">${escapeHtml(c.userAgent)}</span>
          </div>
        </td>

        <td class="px-4 py-3 text-right">
          <strong class="text-zinc-900 dark:text-zinc-100 font-bold text-sm">${(c.totalRequests || 0).toLocaleString()}</strong>
        </td>

        <td class="px-4 py-3 text-right text-[11px] text-zinc-500">
          <div>↓ ${formatBytes(c.bytesIn)}</div>
          <div>↑ ${formatBytes(c.bytesOut)}</div>
        </td>

        <td class="px-4 py-3 text-center">
          ${statusCodesMarkup}
        </td>

        <td class="px-4 py-3 text-zinc-500 text-[11px]">
          <div>${formatRelativeTime(c.lastActiveAt)}</div>
          <div class="text-[10px] text-zinc-400">${new Date(c.lastActiveAt).toLocaleTimeString()}</div>
        </td>

        <td class="px-4 py-3 text-center">
          <button
            type="button"
            class="btn-inspect-ip-logs px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-xs font-semibold transition cursor-pointer active:scale-95 flex items-center gap-1 mx-auto"
            data-ip="${escapeHtml(c.ip)}"
          >
            <i data-lucide="scroll-text" class="w-3.5 h-3.5"></i>
            <span>Xem Log</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Opens detailed request stream log drawer/modal for a specific IP
 */
export async function openIpRequestLogsDrawer(ip) {
  activeInspectedIp = ip;
  const modalId = 'modalIpRequestStreamDrawer';
  const oldModal = document.getElementById(modalId);
  if (oldModal) oldModal.remove();

  const drawerHtml = `
    <div id="${modalId}" class="fixed inset-0 z-[9996] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div class="relative w-full max-w-3xl max-h-[92vh] rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#111114] p-5 sm:p-6 shadow-2xl flex flex-col space-y-4 overflow-hidden">
        
        <!-- Header -->
        <div class="flex items-start justify-between gap-3 shrink-0 pb-3 border-b border-zinc-100 dark:border-white/5">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0 shadow-inner">
              <i data-lucide="radio" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Luồng Request Trực Tiếp: <span class="font-mono text-orange-500">${escapeHtml(ip)}</span>
              </h3>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Nhật ký 30 yêu cầu HTTP gần nhất xuất phát từ riêng địa chỉ IP này
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btnCloseIpLogsDrawer"
            class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            title="Đóng"
          >
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Dynamic Body -->
        <div id="ipLogsDrawerContent" class="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[350px]">
          <div class="py-16 text-center text-zinc-500 text-xs font-mono">
            <span class="inline-block animate-spin mr-2">⟳</span> Đang tải luồng log của ${escapeHtml(ip)}...
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', drawerHtml);
  if (window.lucide) window.lucide.createIcons();

  const modalEl = document.getElementById(modalId);
  const close = () => { if (modalEl) modalEl.remove(); };
  modalEl.querySelector('#btnCloseIpLogsDrawer').onclick = close;

  await refreshIpLogsContent(modalEl, ip);
}

/**
 * Fetches and updates logs inside the IP logs drawer
 */
async function refreshIpLogsContent(modalEl, ip) {
  const contentEl = modalEl.querySelector('#ipLogsDrawerContent');
  if (!contentEl) return;

  try {
    const resp = await fetch(`/api/v1/admin/traffic/ips/${encodeURIComponent(ip)}/logs`, {
      headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
    });
    const json = await resp.json();
    const data = json.data || {};
    const profile = data.profile || {};
    const logs = data.logs || [];

    contentEl.innerHTML = `
      <!-- Profile Summary Banner -->
      <div class="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-white/5 text-xs font-mono grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <span class="text-[10px] text-zinc-500 block">Quốc gia & Phân loại</span>
          <span class="font-bold text-zinc-200">${profile.country || 'N/A'} · ${profile.isLan ? 'LAN' : 'WAN'}</span>
        </div>
        <div>
          <span class="text-[10px] text-zinc-500 block">Tổng Requests</span>
          <span class="font-bold text-orange-400">${(profile.totalRequests || 0).toLocaleString()} reqs</span>
        </div>
        <div>
          <span class="text-[10px] text-zinc-500 block">Lưu lượng In / Out</span>
          <span class="font-bold text-zinc-200">${formatBytes(profile.bytesIn)} / ${formatBytes(profile.bytesOut)}</span>
        </div>
        <div>
          <span class="text-[10px] text-zinc-500 block">Thiết bị</span>
          <span class="font-bold text-zinc-200 truncate block" title="${escapeHtml(profile.deviceSummary)}">${escapeHtml(profile.deviceSummary || 'Unknown')}</span>
        </div>
      </div>

      <!-- Logs Table -->
      ${logs.length === 0 ? `
        <div class="py-16 text-center text-zinc-500 text-xs">
          <p class="font-bold text-zinc-400">Chưa có request nào được ghi lại</p>
        </div>
      ` : `
        <div class="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-zinc-950/40">
          <table class="w-full text-left text-xs font-mono">
            <thead class="bg-zinc-100 dark:bg-zinc-900/60 text-zinc-500 text-[11px] border-b border-zinc-200 dark:border-white/5">
              <tr>
                <th class="px-3.5 py-2.5">Thời Gian</th>
                <th class="px-3.5 py-2.5">Method</th>
                <th class="px-3.5 py-2.5">Route / Endpoint</th>
                <th class="px-3.5 py-2.5 text-center">Status</th>
                <th class="px-3.5 py-2.5 text-right">Độ Trễ</th>
                <th class="px-3.5 py-2.5 text-right">Kích Thước</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-200/60 dark:divide-white/5 text-zinc-800 dark:text-zinc-200">
              ${logs.map(log => {
                const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '--:--:--';
                let methodBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">${escapeHtml(log.method)}</span>`;
                if (log.method === 'GET') methodBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">GET</span>`;
                else if (log.method === 'POST') methodBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">POST</span>`;
                else if (log.method === 'DELETE') methodBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">DEL</span>`;

                let statusBadge = `<span class="text-emerald-500 font-bold">${log.statusCode}</span>`;
                if (log.statusCode >= 400 && log.statusCode < 500) statusBadge = `<span class="text-amber-500 font-bold">${log.statusCode}</span>`;
                else if (log.statusCode >= 500) statusBadge = `<span class="text-rose-500 font-bold">${log.statusCode}</span>`;

                return `
                  <tr class="hover:bg-white/[0.02]">
                    <td class="px-3.5 py-2 text-zinc-400">${timeStr}</td>
                    <td class="px-3.5 py-2">${methodBadge}</td>
                    <td class="px-3.5 py-2 text-zinc-200 font-medium truncate max-w-[260px]" title="${escapeHtml(log.route)}">${escapeHtml(log.route)}</td>
                    <td class="px-3.5 py-2 text-center">${statusBadge}</td>
                    <td class="px-3.5 py-2 text-right text-zinc-400">${log.latencyMs}ms</td>
                    <td class="px-3.5 py-2 text-right text-zinc-500 text-[11px]">${formatBytes(log.contentLengthOut || log.contentLengthIn)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;
  } catch (err) {
    contentEl.innerHTML = `
      <div class="p-6 text-center text-rose-500 text-xs">
        Lỗi khi tải luồng log: ${escapeHtml(err.message)}
      </div>
    `;
  }

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Attaches event listeners and triggers initial fetch of IP client telemetry
 */
export function attachIpTrafficListeners(containerEl) {
  if (!containerEl) return;

  const tableBody = containerEl.querySelector('#ipClientsTableBody');
  const countBadge = containerEl.querySelector('#ipClientsCountBadge');
  const btnRefresh = containerEl.querySelector('#btnRefreshIpClients');
  const searchInput = containerEl.querySelector('#inputSearchIpClients');
  const filterButtons = containerEl.querySelectorAll('.btn-ip-filter');

  const fetchAndRender = async () => {
    try {
      const resp = await fetch('/api/v1/admin/traffic/ips', {
        headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
      });
      const json = await resp.json();
      if (json.success && Array.isArray(json.data?.clients)) {
        cachedClients = json.data.clients;
        applyFiltersAndRender();
      }
    } catch (err) {
      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="8" class="px-4 py-8 text-center text-rose-500 font-sans">
              Không thể tải danh sách lưu lượng IP: ${escapeHtml(err.message)}
            </td>
          </tr>
        `;
      }
    }
  };

  const applyFiltersAndRender = () => {
    let filtered = [...cachedClients];

    // Filter by type
    if (activeFilter === 'lan') {
      filtered = filtered.filter(c => c.isLan);
    } else if (activeFilter === 'wan') {
      filtered = filtered.filter(c => !c.isLan);
    } else if (activeFilter === 'errors') {
      filtered = filtered.filter(c => (c.status4xx || 0) + (c.status5xx || 0) > 0);
    }

    // Search query
    if (currentSearch.trim()) {
      const q = currentSearch.toLowerCase().trim();
      filtered = filtered.filter(c =>
        (c.ip || '').toLowerCase().includes(q) ||
        (c.country || '').toLowerCase().includes(q) ||
        (c.deviceSummary || '').toLowerCase().includes(q) ||
        (c.userAgent || '').toLowerCase().includes(q)
      );
    }

    if (tableBody) {
      tableBody.innerHTML = renderIpTableRows(filtered);
      // Attach click listeners to inspect log buttons
      tableBody.querySelectorAll('.btn-inspect-ip-logs').forEach(btn => {
        btn.onclick = () => {
          openIpRequestLogsDrawer(btn.dataset.ip);
        };
      });
      if (window.lucide) window.lucide.createIcons();
    }

    if (countBadge) {
      countBadge.textContent = `${cachedClients.length} clients`;
    }
  };

  // Refresh button
  if (btnRefresh) {
    btnRefresh.onclick = async () => {
      btnRefresh.disabled = true;
      btnRefresh.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> <span>Đang nạp...</span>';
      if (window.lucide) window.lucide.createIcons();
      await fetchAndRender();
      btnRefresh.disabled = false;
      btnRefresh.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> <span>Làm Mới</span>';
      if (window.lucide) window.lucide.createIcons();
      showToast('Đã làm mới danh sách IP clients', 'info');
    };
  }

  // Search input
  if (searchInput) {
    searchInput.oninput = (e) => {
      currentSearch = e.target.value;
      applyFiltersAndRender();
    };
  }

  // Filter pills
  filterButtons.forEach(btn => {
    btn.onclick = () => {
      activeFilter = btn.dataset.ipFilter;
      filterButtons.forEach(b => {
        const isCurrent = b.dataset.ipFilter === activeFilter;
        b.className = `btn-ip-filter px-3 py-1.5 rounded-xl transition cursor-pointer ${isCurrent ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`;
      });
      applyFiltersAndRender();
    };
  });

  // Initial fetch
  fetchAndRender();
}
