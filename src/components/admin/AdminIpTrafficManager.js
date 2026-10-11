/**
 * AdminIpTrafficManager.js - User & Client IP Traffic Manager (#admin tab 2)
 * Dual-tab interface:
 * 1. IP Traffic & Access Control Rules (Live telemetry, 1-click Block/Unblock, Custom RPM Rate Limiting, Pre-configured IP rules, Aliases, Notes)
 * 2. User Accounts Management (Prisma User CRUD, Roles, Rate Limits, API Keys)
 */

import { getStorageAuthHeaders } from '../../utilities/adminAuth.js';
import { showToast } from '../../utilities/toast.js';
import { renderUsersManager, attachUsersManagerListeners } from './AdminUsersManager.js';

let cachedClients = [];
let cachedRules = [];
let activeSubTab = 'traffic'; // 'traffic' | 'users'
let activeFilter = 'all'; // 'all' | 'lan' | 'wan' | 'blocked' | 'rate_limited' | 'errors'
let currentSearch = '';
let activeInspectedIp = null;

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
 * Renders the User & IP Traffic Manager markup with sub-tabs
 */
export function renderIpTrafficManager() {
  return `
    <div id="adminIpTrafficContainer" class="space-y-6">
      <!-- Top Card: Summary & Sub-Tab Switcher -->
      <div class="p-6 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 backdrop-blur-xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-sky-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <i data-lucide="shield-alert" class="w-5 h-5"></i>
          </div>
          <div>
            <h2 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Quản Trị Người Dùng & Kiểm Soát Truy Cập
              <span id="ipClientsCountBadge" class="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                0 clients
              </span>
            </h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Phân quyền tài khoản, quy tắc chặn IP, giới hạn tần suất yêu cầu (Rate Limit) và theo dõi lưu lượng
            </p>
          </div>
        </div>

        <!-- Sub-Tab Switcher Pills -->
        <div class="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-950/80 border border-zinc-200 dark:border-white/5">
          <button
            type="button"
            id="subTabBtnTraffic"
            class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'traffic' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/50 dark:border-white/10' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}"
          >
            <i data-lucide="network" class="w-3.5 h-3.5 text-orange-500"></i>
            <span>Lưu Lượng & Quy Tắc IP</span>
          </button>
          <button
            type="button"
            id="subTabBtnUsers"
            class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'users' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/50 dark:border-white/10' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}"
          >
            <i data-lucide="users" class="w-3.5 h-3.5 text-orange-500"></i>
            <span>Tài Khoản Người Dùng</span>
          </button>
        </div>
      </div>

      <!-- VIEW 1: IP Traffic & Access Rules -->
      <div id="subViewIpTraffic" class="${activeSubTab === 'traffic' ? 'space-y-6' : 'hidden space-y-6'}">
        <!-- Filters & Action Bar -->
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
              Mạng LAN
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
              data-ip-filter="blocked"
              class="btn-ip-filter px-3 py-1.5 rounded-xl transition cursor-pointer ${activeFilter === 'blocked' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
            >
              Đang Chặn
            </button>
            <button
              type="button"
              data-ip-filter="rate_limited"
              class="btn-ip-filter px-3 py-1.5 rounded-xl transition cursor-pointer ${activeFilter === 'rate_limited' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
            >
              Đang Giới Hạn (RPM)
            </button>
            <button
              type="button"
              data-ip-filter="errors"
              class="btn-ip-filter px-3 py-1.5 rounded-xl transition cursor-pointer ${activeFilter === 'errors' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
            >
              Có Lỗi (4xx/5xx)
            </button>
          </div>

          <!-- Search & Action Buttons -->
          <div class="flex items-center gap-2">
            <div class="relative w-full sm:w-64">
              <input
                type="text"
                id="inputSearchIpClients"
                placeholder="Tìm IP, tên gợi nhớ, thiết bị..."
                value="${escapeHtml(currentSearch)}"
                class="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 font-mono shadow-xs"
              />
              <i data-lucide="search" class="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
            </div>

            <button
              type="button"
              id="btnOpenCreateIpRuleModal"
              class="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-orange-500/20 active:scale-95 shrink-0"
              title="Thêm quy tắc chặn hoặc giới hạn rate limit cho IP"
            >
              <i data-lucide="shield-plus" class="w-3.5 h-3.5"></i>
              <span>+ Quy Tắc IP</span>
            </button>

            <button
              type="button"
              id="btnRefreshIpClients"
              class="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold border border-zinc-200 dark:border-white/5 transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs shrink-0"
              title="Làm mới danh sách IP"
            >
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <!-- IP Clients Table Card -->
        <div class="rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 backdrop-blur-xl shadow-xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-zinc-50 dark:bg-zinc-950/60 text-zinc-500 dark:text-zinc-400 font-mono text-[11px] border-b border-zinc-200 dark:border-white/5">
                <tr>
                  <th class="px-4 py-3">Địa Chỉ IP & Tên Gợi Nhớ</th>
                  <th class="px-4 py-3">Phân Loại</th>
                  <th class="px-4 py-3">Kiểm Soát Quyền</th>
                  <th class="px-4 py-3">Thiết Bị / User-Agent</th>
                  <th class="px-4 py-3 text-right">Tổng Requests</th>
                  <th class="px-4 py-3 text-right">Băng Thông</th>
                  <th class="px-4 py-3 text-center">Trạng Thái HTTP</th>
                  <th class="px-4 py-3">Hoạt Động Gần Nhất</th>
                  <th class="px-4 py-3 text-center">Thao Tác Quản Trị</th>
                </tr>
              </thead>
              <tbody id="ipClientsTableBody" class="divide-y divide-zinc-100 dark:divide-white/5 text-zinc-800 dark:text-zinc-200 font-mono">
                <tr>
                  <td colspan="9" class="px-4 py-16 text-center text-zinc-500 font-sans">
                    <span class="inline-block animate-spin mr-2">⟳</span> Đang nạp danh sách lưu lượng & quy tắc IP...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- VIEW 2: User Accounts Manager (rendered via AdminUsersManager) -->
      <div id="subViewUserAccounts" class="${activeSubTab === 'users' ? 'space-y-6' : 'hidden space-y-6'}">
        ${renderUsersManager()}
      </div>
    </div>
  `;
}

/**
 * Combines telemetry client profiles with persistent IP rules
 */
function getCombinedIpList() {
  const map = new Map();

  // Add all telemetry active clients
  for (const c of cachedClients) {
    map.set(c.ip, { ...c });
  }

  // Merge or append rules
  for (const r of cachedRules) {
    const existing = map.get(r.ip);
    if (existing) {
      existing.alias = r.alias;
      existing.note = r.note;
      existing.ruleStatus = r.status;
      existing.rateLimitRpm = r.rateLimitRpm;
      existing.ruleId = r.id;
    } else {
      map.set(r.ip, {
        ip: r.ip,
        isLan: r.ip.startsWith('192.168.') || r.ip.startsWith('10.') || r.ip === '127.0.0.1',
        country: 'N/A',
        userAgent: 'Chưa có lượt truy cập (Quy tắc đặt trước)',
        deviceSummary: 'Quy tắc định sẵn',
        totalRequests: 0,
        bytesIn: 0,
        bytesOut: 0,
        status2xx: 0,
        status3xx: 0,
        status4xx: 0,
        status5xx: 0,
        firstSeenAt: r.createdAt,
        lastActiveAt: r.updatedAt,
        alias: r.alias,
        note: r.note,
        ruleStatus: r.status,
        rateLimitRpm: r.rateLimitRpm,
        ruleId: r.id
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Filters and renders rows in the IP clients table
 */
function renderIpTableRows(combinedList) {
  if (!combinedList || combinedList.length === 0) {
    return `
      <tr>
        <td colspan="9" class="px-4 py-16 text-center text-zinc-500 font-sans">
          <div class="max-w-xs mx-auto space-y-1">
            <p class="font-bold text-zinc-400">Không tìm thấy địa chỉ IP nào phù hợp</p>
            <p class="text-xs text-zinc-500">Hãy thử xóa bộ lọc tìm kiếm hoặc thêm quy tắc IP mới.</p>
          </div>
        </td>
      </tr>
    `;
  }

  return combinedList.map(c => {
    const isLan = c.isLan;
    const countryFlag = getCountryFlag(c.country);
    const countryLabel = c.country || (isLan ? 'LAN' : 'VN');
    const isBlocked = c.ruleStatus === 'blocked';
    const isWhitelisted = c.ruleStatus === 'whitelisted';
    const hasRateLimit = (c.rateLimitRpm || 0) > 0;

    const typeBadge = isLan
      ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">LAN</span>`
      : `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">WAN</span>`;

    let statusPill = `<span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/5">Bình thường</span>`;
    if (isBlocked) {
      statusPill = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30 flex items-center gap-1 w-fit"><i data-lucide="lock" class="w-3 h-3"></i> Đang Chặn</span>`;
    } else if (isWhitelisted) {
      statusPill = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit"><i data-lucide="shield-check" class="w-3 h-3"></i> Whitelist</span>`;
    } else if (hasRateLimit) {
      statusPill = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-fit"><i data-lucide="gauge" class="w-3 h-3"></i> Giới hạn: ${c.rateLimitRpm} RPM</span>`;
    }

    const statusCodesMarkup = `
      <div class="inline-flex items-center gap-1 text-[11px]">
        <span class="text-emerald-500 font-bold" title="2xx OK">${c.status2xx || 0}</span>
        <span class="text-zinc-400">/</span>
        <span class="${c.status4xx > 0 ? 'text-amber-500 font-bold' : 'text-zinc-500'}" title="4xx Error">${c.status4xx || 0}</span>
        <span class="text-zinc-400">/</span>
        <span class="${c.status5xx > 0 ? 'text-rose-500 font-bold' : 'text-zinc-500'}" title="5xx Error">${c.status5xx || 0}</span>
      </div>
    `;

    return `
      <tr class="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition">
        <!-- IP & Alias -->
        <td class="px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="text-base select-none" title="${escapeHtml(countryLabel)}">${countryFlag}</span>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-zinc-900 dark:text-zinc-100">${escapeHtml(c.ip)}</span>
                ${c.alias ? `<span class="px-1.5 py-0.2 rounded text-[10px] font-sans font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">${escapeHtml(c.alias)}</span>` : ''}
              </div>
              <span class="text-[10px] text-zinc-500 font-sans block">
                ${escapeHtml(countryLabel)} ${c.note ? `· ${escapeHtml(c.note)}` : ''}
              </span>
            </div>
          </div>
        </td>

        <!-- Type -->
        <td class="px-4 py-3">
          ${typeBadge}
        </td>

        <!-- Control Status -->
        <td class="px-4 py-3">
          ${statusPill}
        </td>

        <!-- Device -->
        <td class="px-4 py-3 font-sans text-xs">
          <div class="truncate max-w-[200px]" title="${escapeHtml(c.userAgent)}">
            <span class="text-zinc-800 dark:text-zinc-200 font-medium block truncate">${escapeHtml(c.deviceSummary || 'Unknown Device')}</span>
            <span class="text-[10px] text-zinc-500 truncate block mt-0.5">${escapeHtml(c.userAgent)}</span>
          </div>
        </td>

        <!-- Total Requests -->
        <td class="px-4 py-3 text-right">
          <strong class="text-zinc-900 dark:text-zinc-100 font-bold text-sm">${(c.totalRequests || 0).toLocaleString()}</strong>
        </td>

        <!-- Bandwidth -->
        <td class="px-4 py-3 text-right text-[11px] text-zinc-500">
          <div>↓ ${formatBytes(c.bytesIn)}</div>
          <div>↑ ${formatBytes(c.bytesOut)}</div>
        </td>

        <!-- Status Codes -->
        <td class="px-4 py-3 text-center">
          ${statusCodesMarkup}
        </td>

        <!-- Last Active -->
        <td class="px-4 py-3 text-zinc-500 text-[11px]">
          <div>${formatRelativeTime(c.lastActiveAt)}</div>
          <div class="text-[10px] text-zinc-400">${new Date(c.lastActiveAt).toLocaleTimeString()}</div>
        </td>

        <!-- Actions -->
        <td class="px-4 py-3 text-center">
          <div class="flex items-center justify-center gap-1">
            <!-- 1-Click Toggle Block -->
            <button
              type="button"
              class="btn-toggle-block-ip px-2 py-1 rounded-lg ${isBlocked ? 'bg-rose-500 text-white font-bold' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20'} text-[11px] transition cursor-pointer active:scale-95"
              data-ip="${escapeHtml(c.ip)}"
              data-blocked="${isBlocked}"
              title="${isBlocked ? 'Bỏ chặn IP này' : 'Chặn IP này ngay lập tức (HTTP 403)'}"
            >
              <i data-lucide="${isBlocked ? 'unlock' : 'lock'}" class="w-3.5 h-3.5"></i>
            </button>

            <!-- Set Rate Limit -->
            <button
              type="button"
              class="btn-set-rate-limit-ip px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 text-[11px] font-semibold transition cursor-pointer active:scale-95"
              data-ip="${escapeHtml(c.ip)}"
              data-rpm="${c.rateLimitRpm || 0}"
              title="Đặt hạn mức Rate Limit (RPM)"
            >
              <i data-lucide="gauge" class="w-3.5 h-3.5"></i>
            </button>

            <!-- Edit Alias & Notes -->
            <button
              type="button"
              class="btn-edit-ip-rule px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold transition cursor-pointer active:scale-95"
              data-ip="${escapeHtml(c.ip)}"
              data-alias="${escapeHtml(c.alias || '')}"
              data-note="${escapeHtml(c.note || '')}"
              data-status="${c.ruleStatus || 'active'}"
              data-rpm="${c.rateLimitRpm || 0}"
              title="Sửa biệt danh, ghi chú hoặc quy tắc"
            >
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>

            <!-- Inspect Logs -->
            <button
              type="button"
              class="btn-inspect-ip-logs px-2 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 text-[11px] font-semibold transition cursor-pointer active:scale-95"
              data-ip="${escapeHtml(c.ip)}"
              title="Xem luồng 30 request gần nhất"
            >
              <i data-lucide="scroll-text" class="w-3.5 h-3.5"></i>
            </button>

            <!-- Reset / Delete -->
            <button
              type="button"
              class="btn-reset-ip-traffic text-zinc-400 hover:text-zinc-200 p-1 rounded-lg transition cursor-pointer"
              data-ip="${escapeHtml(c.ip)}"
              title="Đặt lại thống kê / xóa quy tắc IP"
            >
              <i data-lucide="trash" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Modal to add or edit an IP access rule
 */
function openUpsertIpRuleModal(initialData = {}, onSuccess) {
  const modalId = 'modalUpsertIpRule';
  const oldModal = document.getElementById(modalId);
  if (oldModal) oldModal.remove();

  const ip = initialData.ip || '';
  const alias = initialData.alias || '';
  const note = initialData.note || '';
  const status = initialData.status || 'active';
  const rpm = initialData.rpm !== undefined ? initialData.rpm : 0;

  const html = `
    <div id="${modalId}" class="fixed inset-0 z-[9998] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div class="relative w-full max-w-md rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#111114] p-5 sm:p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
              <i data-lucide="shield" class="w-4 h-4"></i>
            </div>
            <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
              ${ip ? 'Cấu Hình Quy Tắc IP' : 'Thêm Quy Tắc Kiểm Soát IP'}
            </h3>
          </div>
          <button type="button" id="btnCloseUpsertIpRuleModal" class="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-xl cursor-pointer">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <form id="formUpsertIpRule" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Địa chỉ IP *</label>
            <input
              type="text"
              name="ip"
              value="${escapeHtml(ip)}"
              ${ip ? 'readonly' : ''}
              required
              placeholder="ví dụ: 192.168.2.150 hoặc 113.161.x.x"
              class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tên gợi nhớ (Biệt danh / Alias)</label>
            <input
              type="text"
              name="alias"
              value="${escapeHtml(alias)}"
              placeholder="ví dụ: MacBook của Duy, Máy phòng khách..."
              class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Quyền truy cập</label>
              <select
                name="status"
                class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
              >
                <option value="active" ${status === 'active' ? 'selected' : ''}>Bình thường (Active)</option>
                <option value="blocked" ${status === 'blocked' ? 'selected' : ''}>Chặn truy cập (403)</option>
                <option value="rate_limited" ${status === 'rate_limited' ? 'selected' : ''}>Áp dụng Rate Limit</option>
                <option value="whitelisted" ${status === 'whitelisted' ? 'selected' : ''}>Whitelist (Ưu tiên)</option>
              </select>
            </div>

            <div>
              <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Rate Limit (RPM)</label>
              <input
                type="number"
                name="rateLimitRpm"
                min="0"
                max="10000"
                value="${rpm}"
                placeholder="0 = Không giới hạn"
                class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Ghi chú chi tiết</label>
            <textarea
              name="note"
              rows="2"
              placeholder="Ghi chú lý do chặn hoặc theo dõi..."
              class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
            >${escapeHtml(note)}</textarea>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-white/5">
            <button
              type="button"
              id="btnCancelUpsertIpRule"
              class="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              id="btnSubmitUpsertIpRule"
              class="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold cursor-pointer transition shadow-md shadow-orange-500/20"
            >
              Lưu Quy Tắc
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
  if (window.lucide) window.lucide.createIcons();

  const modalEl = document.getElementById(modalId);
  const close = () => { if (modalEl) modalEl.remove(); };
  modalEl.querySelector('#btnCloseUpsertIpRuleModal').onclick = close;
  modalEl.querySelector('#btnCancelUpsertIpRule').onclick = close;

  const form = modalEl.querySelector('#formUpsertIpRule');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = modalEl.querySelector('#btnSubmitUpsertIpRule');
    btn.disabled = true;
    btn.textContent = 'Đang lưu...';

    const formData = new FormData(form);
    const targetIp = formData.get('ip').trim();
    const payload = {
      ip: targetIp,
      alias: formData.get('alias')?.trim() || null,
      note: formData.get('note')?.trim() || null,
      status: formData.get('status'),
      rateLimitRpm: parseInt(formData.get('rateLimitRpm') || '0', 10)
    };

    try {
      const res = await fetch('/api/v1/admin/traffic/rules', {
        method: 'POST',
        headers: {
          ...getStorageAuthHeaders(),
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Lưu quy tắc thất bại');

      showToast(json.message || 'Đã lưu quy tắc IP', 'success');
      close();
      if (onSuccess) onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Lưu Quy Tắc';
    }
  };
}

/**
 * Modal to quickly configure rate limit for an IP
 */
function openQuickRateLimitModal(ip, currentRpm = 0, onSuccess) {
  const modalId = 'modalQuickRateLimit';
  const oldModal = document.getElementById(modalId);
  if (oldModal) oldModal.remove();

  const presets = [
    { label: 'Không giới hạn (0)', val: 0 },
    { label: 'Chặt chẽ (30 RPM)', val: 30 },
    { label: 'Trung bình (60 RPM)', val: 60 },
    { label: 'Thoải mái (120 RPM)', val: 120 },
    { label: 'Cao (300 RPM)', val: 300 }
  ];

  const html = `
    <div id="${modalId}" class="fixed inset-0 z-[9998] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div class="relative w-full max-w-sm rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#111114] p-5 sm:p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <i data-lucide="gauge" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Đặt Rate Limit (RPM)</h3>
              <p class="text-[11px] font-mono text-zinc-400">${escapeHtml(ip)}</p>
            </div>
          </div>
          <button type="button" id="btnCloseRateLimitModal" class="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-xl cursor-pointer">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <label class="block font-medium text-zinc-700 dark:text-zinc-300">Chọn mức định sẵn:</label>
          <div class="grid grid-cols-2 gap-2">
            ${presets.map(p => `
              <button
                type="button"
                class="btn-preset-rpm px-2.5 py-2 rounded-xl text-left border transition cursor-pointer ${currentRpm === p.val ? 'bg-sky-500 text-white border-sky-500 font-bold' : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-sky-500/50'}"
                data-val="${p.val}"
              >
                ${p.label}
              </button>
            `).join('')}
          </div>

          <div class="pt-2">
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Hoặc nhập RPM tùy chỉnh:</label>
            <input
              type="number"
              id="inputCustomRpm"
              value="${currentRpm}"
              min="0"
              max="10000"
              placeholder="0 = Không giới hạn"
              class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-sky-500 text-sm font-bold"
            />
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-white/5">
            <button
              type="button"
              id="btnCancelRateLimit"
              class="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              id="btnSaveRateLimit"
              class="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold cursor-pointer transition shadow-md shadow-sky-500/20"
            >
              Áp Dụng
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
  if (window.lucide) window.lucide.createIcons();

  const modalEl = document.getElementById(modalId);
  const close = () => { if (modalEl) modalEl.remove(); };
  modalEl.querySelector('#btnCloseRateLimitModal').onclick = close;
  modalEl.querySelector('#btnCancelRateLimit').onclick = close;

  const inputCustom = modalEl.querySelector('#inputCustomRpm');
  modalEl.querySelectorAll('.btn-preset-rpm').forEach(btn => {
    btn.onclick = () => {
      inputCustom.value = btn.dataset.val;
      modalEl.querySelectorAll('.btn-preset-rpm').forEach(b => {
        const isCurrent = b === btn;
        b.className = `btn-preset-rpm px-2.5 py-2 rounded-xl text-left border transition cursor-pointer ${isCurrent ? 'bg-sky-500 text-white border-sky-500 font-bold' : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-sky-500/50'}`;
      });
    };
  });

  modalEl.querySelector('#btnSaveRateLimit').onclick = async () => {
    const rpmVal = parseInt(inputCustom.value || '0', 10);
    try {
      const res = await fetch(`/api/v1/admin/traffic/ips/${encodeURIComponent(ip)}/set-rate-limit`, {
        method: 'POST',
        headers: {
          ...getStorageAuthHeaders(),
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ rateLimitRpm: rpmVal })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Cài đặt rate limit thất bại');
      showToast(json.message, 'success');
      close();
      if (onSuccess) onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
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
          <span class="text-[10px] text-zinc-500 block">Hoạt động gần nhất</span>
          <span class="font-bold text-zinc-200">${formatRelativeTime(profile.lastActiveAt)}</span>
        </div>
      </div>

      <!-- Logs Table -->
      ${logs.length === 0 ? `
        <div class="py-12 text-center text-zinc-500 text-xs">
          Chưa có nhật ký HTTP nào được ghi nhận cho IP này.
        </div>
      ` : `
        <div class="rounded-2xl border border-zinc-200 dark:border-white/5 overflow-hidden">
          <table class="w-full text-left text-xs font-mono">
            <thead class="bg-zinc-100 dark:bg-zinc-950/60 text-zinc-400 text-[10px] border-b border-zinc-200 dark:border-white/5">
              <tr>
                <th class="px-3 py-2">Thời Gian</th>
                <th class="px-3 py-2">Method</th>
                <th class="px-3 py-2">Route</th>
                <th class="px-3 py-2 text-center">Status</th>
                <th class="px-3 py-2 text-right">Độ Trễ</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-100 dark:divide-white/5 text-[11px]">
              ${logs.map(l => {
                const isErr = l.statusCode >= 400;
                const statusColor = l.statusCode >= 500 ? 'text-rose-500 bg-rose-500/10' :
                  l.statusCode >= 400 ? 'text-amber-500 bg-amber-500/10' : 'text-emerald-500 bg-emerald-500/10';
                return `
                  <tr class="hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                    <td class="px-3 py-2 text-zinc-500">${new Date(l.timestamp).toLocaleTimeString()}</td>
                    <td class="px-3 py-2 font-bold text-zinc-300">${escapeHtml(l.method)}</td>
                    <td class="px-3 py-2 text-zinc-200 truncate max-w-[280px]" title="${escapeHtml(l.route)}">${escapeHtml(l.route)}</td>
                    <td class="px-3 py-2 text-center">
                      <span class="px-1.5 py-0.5 rounded ${statusColor} font-bold">${l.statusCode}</span>
                    </td>
                    <td class="px-3 py-2 text-right text-zinc-400">${l.latencyMs}ms</td>
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
 * Attaches event listeners for IP Traffic & User Manager
 */
export function attachIpTrafficListeners(containerEl) {
  if (!containerEl) return;

  const subTabBtnTraffic = containerEl.querySelector('#subTabBtnTraffic');
  const subTabBtnUsers = containerEl.querySelector('#subTabBtnUsers');
  const subViewTraffic = containerEl.querySelector('#subViewIpTraffic');
  const subViewUsers = containerEl.querySelector('#subViewUserAccounts');

  // Sub-tab toggling
  const switchSubTab = (tab) => {
    activeSubTab = tab;
    if (tab === 'traffic') {
      subTabBtnTraffic.className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/50 dark:border-white/10';
      subTabBtnUsers.className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200';
      subViewTraffic.classList.remove('hidden');
      subViewUsers.classList.add('hidden');
      fetchAndRenderIpData();
    } else {
      subTabBtnUsers.className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/50 dark:border-white/10';
      subTabBtnTraffic.className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200';
      subViewUsers.classList.remove('hidden');
      subViewTraffic.classList.add('hidden');
      attachUsersManagerListeners();
    }
  };

  if (subTabBtnTraffic) subTabBtnTraffic.onclick = () => switchSubTab('traffic');
  if (subTabBtnUsers) subTabBtnUsers.onclick = () => switchSubTab('users');

  // IP Table DOM elements
  const tableBody = containerEl.querySelector('#ipClientsTableBody');
  const countBadge = containerEl.querySelector('#ipClientsCountBadge');
  const btnRefresh = containerEl.querySelector('#btnRefreshIpClients');
  const searchInput = containerEl.querySelector('#inputSearchIpClients');
  const filterButtons = containerEl.querySelectorAll('.btn-ip-filter');
  const btnCreateRule = containerEl.querySelector('#btnOpenCreateIpRuleModal');

  const fetchAndRenderIpData = async () => {
    try {
      const [respIps, respRules] = await Promise.all([
        fetch('/api/v1/admin/traffic/ips', { headers: { ...getStorageAuthHeaders(), Accept: 'application/json' } }),
        fetch('/api/v1/admin/traffic/rules', { headers: { ...getStorageAuthHeaders(), Accept: 'application/json' } })
      ]);

      const jsonIps = await respIps.json();
      const jsonRules = await respRules.json();

      if (jsonIps.success && Array.isArray(jsonIps.data?.clients)) {
        cachedClients = jsonIps.data.clients;
      }
      if (jsonRules.success && Array.isArray(jsonRules.data)) {
        cachedRules = jsonRules.data;
      }

      applyFiltersAndRender();
    } catch (err) {
      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="9" class="px-4 py-8 text-center text-rose-500 font-sans">
              Không thể tải danh sách lưu lượng IP: ${escapeHtml(err.message)}
            </td>
          </tr>
        `;
      }
    }
  };

  const applyFiltersAndRender = () => {
    const combined = getCombinedIpList();
    let filtered = [...combined];

    // Filter by category
    if (activeFilter === 'lan') {
      filtered = filtered.filter(c => c.isLan);
    } else if (activeFilter === 'wan') {
      filtered = filtered.filter(c => !c.isLan);
    } else if (activeFilter === 'blocked') {
      filtered = filtered.filter(c => c.ruleStatus === 'blocked');
    } else if (activeFilter === 'rate_limited') {
      filtered = filtered.filter(c => (c.rateLimitRpm || 0) > 0);
    } else if (activeFilter === 'errors') {
      filtered = filtered.filter(c => (c.status4xx || 0) + (c.status5xx || 0) > 0);
    }

    // Search query
    if (currentSearch.trim()) {
      const q = currentSearch.toLowerCase().trim();
      filtered = filtered.filter(c =>
        (c.ip || '').toLowerCase().includes(q) ||
        (c.alias || '').toLowerCase().includes(q) ||
        (c.note || '').toLowerCase().includes(q) ||
        (c.country || '').toLowerCase().includes(q) ||
        (c.deviceSummary || '').toLowerCase().includes(q)
      );
    }

    if (tableBody) {
      tableBody.innerHTML = renderIpTableRows(filtered);
      if (window.lucide) window.lucide.createIcons();
    }

    if (countBadge) {
      countBadge.textContent = `${combined.length} clients`;
    }
  };

  // Delegated Actions in IP Table
  if (tableBody) {
    tableBody.onclick = async (e) => {
      // 1. Inspect Logs
      const inspectBtn = e.target.closest('.btn-inspect-ip-logs');
      if (inspectBtn) {
        openIpRequestLogsDrawer(inspectBtn.dataset.ip);
        return;
      }

      // 2. Toggle Block
      const blockBtn = e.target.closest('.btn-toggle-block-ip');
      if (blockBtn) {
        const ip = blockBtn.dataset.ip;
        const isBlocked = blockBtn.dataset.blocked === 'true';
        const actionLabel = isBlocked ? 'mở khóa' : 'chặn hoàn toàn';
        if (!confirm(`Bạn có chắc muốn ${actionLabel} IP '${ip}'?`)) return;

        try {
          const res = await fetch(`/api/v1/admin/traffic/ips/${encodeURIComponent(ip)}/toggle-block`, {
            method: 'POST',
            headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.message || 'Thao tác thất bại');
          showToast(json.message, 'success');
          fetchAndRenderIpData();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 3. Set Rate Limit
      const rpmBtn = e.target.closest('.btn-set-rate-limit-ip');
      if (rpmBtn) {
        const ip = rpmBtn.dataset.ip;
        const currentRpm = parseInt(rpmBtn.dataset.rpm || '0', 10);
        openQuickRateLimitModal(ip, currentRpm, () => fetchAndRenderIpData());
        return;
      }

      // 4. Edit Rule / Alias
      const editBtn = e.target.closest('.btn-edit-ip-rule');
      if (editBtn) {
        openUpsertIpRuleModal({
          ip: editBtn.dataset.ip,
          alias: editBtn.dataset.alias,
          note: editBtn.dataset.note,
          status: editBtn.dataset.status,
          rpm: parseInt(editBtn.dataset.rpm || '0', 10)
        }, () => fetchAndRenderIpData());
        return;
      }

      // 5. Reset / Delete
      const resetBtn = e.target.closest('.btn-reset-ip-traffic');
      if (resetBtn) {
        const ip = resetBtn.dataset.ip;
        if (!confirm(`Xóa quy tắc và đặt lại bộ đếm lưu lượng cho IP '${ip}'?`)) return;

        try {
          await Promise.all([
            fetch(`/api/v1/admin/traffic/rules/${encodeURIComponent(ip)}`, {
              method: 'DELETE',
              headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
            }),
            fetch(`/api/v1/admin/traffic/ips/${encodeURIComponent(ip)}/reset`, {
              method: 'POST',
              headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
            })
          ]);
          showToast(`Đã xóa quy tắc và đặt lại lưu lượng cho ${ip}`, 'info');
          fetchAndRenderIpData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    };
  }

  // Add IP Rule Button
  if (btnCreateRule) {
    btnCreateRule.onclick = () => openUpsertIpRuleModal({}, () => fetchAndRenderIpData());
  }

  // Refresh Button
  if (btnRefresh) {
    btnRefresh.onclick = async () => {
      btnRefresh.disabled = true;
      btnRefresh.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>';
      if (window.lucide) window.lucide.createIcons();
      await fetchAndRenderIpData();
      btnRefresh.disabled = false;
      btnRefresh.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>';
      if (window.lucide) window.lucide.createIcons();
      showToast('Đã làm mới danh sách IP clients và quy tắc', 'info');
    };
  }

  // Search Input
  if (searchInput) {
    searchInput.oninput = (e) => {
      currentSearch = e.target.value;
      applyFiltersAndRender();
    };
  }

  // Filter Buttons
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

  // Initial load
  if (activeSubTab === 'traffic') {
    fetchAndRenderIpData();
  } else {
    attachUsersManagerListeners();
  }
}
