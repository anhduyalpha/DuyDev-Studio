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
let cachedSessions = [];
let cachedDevices = [];
let cachedSessionStats = { totalTracked: 0, onlineCount: 0, idleCount: 0, leftCount: 0, avgDurationSec: 0 };
let cachedEvents = [];
let activeSubTab = 'sessions'; // 'sessions' | 'traffic' | 'users'
let activeFilter = 'all'; // 'all' | 'lan' | 'wan' | 'blocked' | 'rate_limited' | 'errors'
let activeSessionFilter = 'all'; // 'all' | 'online' | 'owner' | 'lan' | 'wan'
let currentSearch = '';
let currentSessionSearch = '';
let activeInspectedIp = null;

function formatCompactIp(ip) {
  if (!ip) return '--';
  if (ip.includes(':') && ip.length > 18) {
    const parts = ip.split(':').filter(Boolean);
    if (parts.length >= 3) {
      return `${parts[0]}:${parts[1]}...${parts[parts.length - 1]}`;
    }
    return `${ip.slice(0, 9)}...${ip.slice(-4)}`;
  }
  return ip;
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

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i] || 'MB'}`;
}

function formatDuration(sec) {
  if (sec == null || isNaN(sec)) return '--';
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remS = s % 60;
  if (m < 60) return `${m}m ${remS}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}

function formatExactClock(isoString) {
  if (!isoString) return '--';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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

function renderSessionCardsMarkup(devices) {
  if (!devices || devices.length === 0) {
    return `
      <div class="py-12 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-white/5 space-y-2">
        <div class="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
          <i data-lucide="smartphone" class="w-5 h-5"></i>
        </div>
        <p class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Chưa ghi nhận thiết bị nào</p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
          Khi có người truy cập (LAN, WAN, 4G/5G), danh tính thiết bị và lịch sử phiên truy cập sẽ được tổng hợp scannable tại đây.
        </p>
      </div>
    `;
  }

  // Sort: ONLINE devices first, then by latest active/entered descending
  const sorted = [...devices].sort((a, b) => {
    if (a.status === 'ONLINE' && b.status !== 'ONLINE') return -1;
    if (b.status === 'ONLINE' && a.status !== 'ONLINE') return 1;
    const timeA = new Date(a.latestSessionLastActiveAt || a.latestSessionEnteredAt || 0).getTime();
    const timeB = new Date(b.latestSessionLastActiveAt || b.latestSessionEnteredAt || 0).getTime();
    return timeB - timeA;
  });

  return sorted.map(d => {
    const isOnline = d.status === 'ONLINE';
    const isIdle = d.status === 'IDLE';
    const isBlocked = !!d.isBlocked;

    let statusBadge = '';
    if (isBlocked) {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30 flex items-center gap-1.5 shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Đã bị chặn</span>`;
    } else if (isOnline) {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5 shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"></span> Đang online</span>`;
    } else if (isIdle) {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25 flex items-center gap-1.5 shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Tạm dừng</span>`;
    } else {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 flex items-center gap-1.5 shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-zinc-500"></span> Đã rời web</span>`;
    }

    const flag = getCountryFlag(d.country);
    const latestDuration = formatDuration(d.latestSessionDurationSec);
    const totalDuration = formatDuration(d.totalAccumulatedDurationSec);
    const enteredTime = formatExactClock(d.latestSessionEnteredAt);
    const enteredRel = formatRelativeTime(d.latestSessionEnteredAt);
    const leftTime = d.latestSessionLeftAt
      ? `${formatExactClock(d.latestSessionLeftAt)} (${formatRelativeTime(d.latestSessionLeftAt)})`
      : (isOnline ? 'Đang duyệt trang...' : (isIdle ? 'Tạm ngưng...' : '--'));

    const primaryIp = d.lastIp || d.ip || '';
    const compactIp = formatCompactIp(primaryIp);

    const pwaBadge = d.pwaMode
      ? `<span class="px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20 text-[9px] font-bold tracking-tight">PWA</span>`
      : `<span class="px-1.5 py-0.2 rounded bg-zinc-500/10 text-zinc-400 border border-zinc-500/15 text-[9px] font-medium">WEB</span>`;

    const netBadge = d.isLan
      ? `<span class="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">🏠 LAN</span>`
      : `<span class="px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] font-bold">🌐 WAN</span>`;

    const ownerBadge = d.isOwner
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1">👑 Chủ nhà</span>`
      : '';

    const isMultiDevice = (d.devicesCount || 1) > 1;
    const avatarHtml = d.avatar
      ? `<img src="${escapeHtml(d.avatar)}" class="w-6 h-6 rounded-full object-cover border border-zinc-200 dark:border-white/10 shrink-0" alt="Avatar">`
      : `<div class="w-6 h-6 rounded-full ${d.isOwner ? 'bg-amber-500/15 text-amber-500' : 'bg-indigo-500/15 text-indigo-400'} font-bold flex items-center justify-center text-[10px] shrink-0">${d.isOwner ? '👑' : (d.alias ? escapeHtml(d.alias[0].toUpperCase()) : '👤')}</div>`;

    const devicesDrawerId = `devices_${escapeHtml((d.userId || d.deviceId || '').replace(/[^a-zA-Z0-9_-]/g, '_'))}`;
    const devicesCountBadge = isMultiDevice
      ? `<button
          type="button"
          data-action="toggle-devices-drawer"
          data-target="${devicesDrawerId}"
          class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/25 flex items-center gap-1 shrink-0 transition cursor-pointer active:scale-95"
          title="Xem danh sách ${d.devicesCount} thiết bị liên kết của người dùng này"
        >
          <i data-lucide="layers" class="w-3 h-3"></i>
          <span>${d.devicesCount} thiết bị</span>
          <i data-lucide="chevron-down" class="w-2.5 h-2.5 transition-transform duration-200" id="chevron_${devicesDrawerId}"></i>
        </button>`
      : '';

    const displayName = d.alias
      ? `${d.isOwner ? '👑 ' : ''}${escapeHtml(d.alias)}`
      : (d.isOwner ? '👑 Máy của Duy' : `Khách #${escapeHtml((d.deviceId || '').slice(-6))}`);

    const ipHistoryCount = Array.isArray(d.ipHistory) ? d.ipHistory.length : 1;
    const ipHistoryTooltip = Array.isArray(d.ipHistory) ? d.ipHistory.join(', ') : primaryIp;
    const ipHistoryBadge = ipHistoryCount > 1
      ? `<span class="px-1 py-0.2 rounded text-[9px] font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-help" title="Đã dùng ${ipHistoryCount} IP: ${escapeHtml(ipHistoryTooltip)}">+${ipHistoryCount - 1} IP</span>`
      : '';

    // Deduplicated route breadcrumbs of latest session
    const rawRoutes = Array.isArray(d.latestSessionRouteHistory) && d.latestSessionRouteHistory.length > 0
      ? d.latestSessionRouteHistory.map(r => r.route || '#dashboard')
      : [d.currentRoute || '#dashboard'];
    const dedupRoutes = [];
    for (const r of rawRoutes) {
      if (dedupRoutes.length === 0 || dedupRoutes[dedupRoutes.length - 1] !== r) {
        dedupRoutes.push(r);
      }
    }
    const recentRoutes = dedupRoutes.slice(-5);
    const breadcrumbHtml = recentRoutes.map((r, i) => {
      const isCurrent = i === recentRoutes.length - 1;
      return `<span class="px-1.5 py-0.5 rounded-md font-mono text-[10px] ${isCurrent ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25 font-bold' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300/50 dark:border-white/5'}">${escapeHtml(r)}</span>`;
    }).join('<span class="text-zinc-400 dark:text-zinc-600 text-[10px] mx-0.5">➔</span>');

    const pastSessions = Array.isArray(d.pastSessions) ? d.pastSessions : [];
    const hasPastSessions = pastSessions.length > 0;
    const drawerId = `pastSessions_${escapeHtml((d.deviceId || '').replace(/[^a-zA-Z0-9_-]/g, '_'))}`;

    const cardBorder = isBlocked
      ? 'border-rose-500/40 bg-rose-500/5'
      : (isOnline
        ? 'border-emerald-500/30 shadow-emerald-500/5 bg-zinc-50/80 dark:bg-zinc-950/60'
        : (isIdle
          ? 'border-amber-500/20 bg-zinc-50/80 dark:bg-zinc-950/60'
          : 'border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-zinc-950/60'));

    return `
      <div class="p-3.5 sm:p-4 rounded-2xl border ${cardBorder} space-y-2.5 transition shadow-xs">
        <!-- Card Header: Device Identity & Badges & Top Actions -->
        <div class="flex flex-wrap items-center justify-between gap-2.5">
          <div class="flex flex-wrap items-center gap-2 min-w-0">
            ${statusBadge}
            <span class="text-base leading-none">${flag}</span>
            ${avatarHtml}

            <!-- Device Name & Inline Rename Button -->
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm tracking-tight flex items-center gap-1">
                ${displayName}
              </span>
              <button
                type="button"
                data-action="rename-device"
                data-device-id="${escapeHtml(d.deviceId)}"
                data-alias="${escapeHtml(d.alias || '')}"
                class="text-zinc-400 hover:text-orange-500 cursor-pointer p-0.5 rounded transition"
                title="Đổi tên gợi nhớ thiết bị"
              >
                <i data-lucide="edit-2" class="w-3 h-3"></i>
              </button>
            </div>

            ${devicesCountBadge}
            ${ownerBadge}
            ${netBadge}
            ${pwaBadge}

            <!-- Compact IP & Copy Button -->
            <div class="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-white/5 border border-zinc-200/50 dark:border-white/5 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
              <span title="${escapeHtml(primaryIp)}">${escapeHtml(compactIp)}</span>
              <button
                type="button"
                data-action="copy-text"
                data-copy-text="${escapeHtml(primaryIp)}"
                class="text-zinc-400 hover:text-zinc-200 cursor-pointer p-0.5"
                title="Sao chép toàn bộ IP"
              >
                <i data-lucide="copy" class="w-3 h-3"></i>
              </button>
              ${ipHistoryBadge}
            </div>

            <!-- OS & Browser Badge -->
            <span class="text-[11px] text-zinc-400 font-sans">· ${escapeHtml(d.deviceSummary || 'Web')}</span>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1.5 shrink-0">
            <!-- Set Owner Toggle -->
            <button
              type="button"
              data-action="toggle-owner"
              data-device-id="${escapeHtml(d.deviceId)}"
              data-is-owner="${d.isOwner}"
              class="px-2.5 py-1 rounded-lg ${d.isOwner ? 'bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30' : 'bg-zinc-200/80 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'} text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95"
              title="${d.isOwner ? 'Bỏ đánh dấu Chủ nhà' : 'Đánh dấu thiết bị này là Chủ nhà (Owner)'}"
            >
              <i data-lucide="crown" class="w-3 h-3"></i>
              <span>${d.isOwner ? 'Chủ nhà' : 'Đặt làm Chủ'}</span>
            </button>

            <!-- Block / Unblock Device -->
            <button
              type="button"
              data-action="toggle-device-block"
              data-device-id="${escapeHtml(d.deviceId)}"
              data-blocked="${isBlocked}"
              class="px-2.5 py-1 rounded-lg ${isBlocked ? 'bg-rose-500 text-white font-bold' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20'} text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95"
              title="${isBlocked ? 'Bỏ chặn thiết bị này' : 'Chặn thiết bị này truy cập web'}"
            >
              <i data-lucide="${isBlocked ? 'unlock' : 'shield-ban'}" class="w-3 h-3"></i>
              <span>${isBlocked ? 'Bỏ chặn Máy' : 'Chặn Máy'}</span>
            </button>

            <!-- Inspect IP Logs -->
            <button
              type="button"
              data-inspect-session-ip="${escapeHtml(primaryIp)}"
              class="px-2.5 py-1 rounded-lg bg-zinc-200/80 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95"
              title="Xem nhật ký request của IP này"
            >
              <i data-lucide="file-text" class="w-3 h-3 text-orange-400"></i>
              <span class="hidden sm:inline">Log IP</span>
            </button>

            <!-- Block IP -->
            <button
              type="button"
              data-session-toggle-block="${escapeHtml(primaryIp)}"
              class="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95 border border-rose-500/20"
              title="Chặn IP này"
            >
              <i data-lucide="ban" class="w-3 h-3"></i>
            </button>

            <!-- Delete User & All Linked Devices -->
            <button
              type="button"
              data-action="delete-user-devices"
              data-user-identifier="${escapeHtml(d.userId || d.deviceId)}"
              data-user-name="${escapeHtml(d.alias || displayName)}"
              class="px-2 py-1 rounded-lg bg-zinc-200/80 hover:bg-rose-500/15 hover:text-rose-500 dark:bg-zinc-800 dark:hover:bg-rose-500/20 dark:hover:text-rose-400 text-zinc-400 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95"
              title="Xóa người dùng này và các thiết bị liên kết"
            >
              <i data-lucide="trash-2" class="w-3 h-3"></i>
            </button>
          </div>
        </div>

        <!-- Times & Duration Grid (Latest Session) -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-100 dark:border-white/5 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
          <div>
            <span class="text-[10px] text-zinc-400 block font-sans">Phiên gần nhất:</span>
            <strong class="text-zinc-800 dark:text-zinc-200">${enteredTime}</strong> (${enteredRel})
          </div>
          <div>
            <span class="text-[10px] text-zinc-400 block font-sans">Trạng thái / Rời web:</span>
            <strong class="text-zinc-800 dark:text-zinc-200">${leftTime}</strong>
          </div>
          <div>
            <span class="text-[10px] text-zinc-400 block font-sans">Thời lượng:</span>
            <strong class="text-orange-500 font-bold">${latestDuration}</strong>
            <span class="text-[10px] text-zinc-400 block font-sans">Tổng ${totalDuration} (${d.totalSessionsCount || 1} phiên)</span>
          </div>
          <div>
            <span class="text-[10px] text-zinc-400 block font-sans">Trang đang xem:</span>
            <span class="text-indigo-400 font-bold truncate block">${escapeHtml(d.currentRoute || '#dashboard')}</span>
          </div>
        </div>

        <!-- Route Journey Breadcrumbs -->
        <div class="flex flex-wrap items-center gap-1 pt-1 text-[11px]">
          <span class="text-zinc-400 text-[10px] font-medium mr-1 shrink-0">Lộ trình:</span>
          ${breadcrumbHtml}
        </div>

        <!-- Collapsible Sub-Devices Drawer (if multi-device) -->
        ${isMultiDevice && Array.isArray(d.devices) ? `
          <div id="${devicesDrawerId}" class="hidden pt-2 border-t border-zinc-100 dark:border-white/5 space-y-1.5">
            <div class="flex items-center justify-between text-[11px] text-zinc-500 font-medium px-1">
              <span class="flex items-center gap-1.5">
                <i data-lucide="smartphone" class="w-3 h-3 text-indigo-400"></i>
                <span class="font-bold text-zinc-700 dark:text-zinc-300">Danh sách ${d.devices.length} thiết bị liên kết:</span>
              </span>
              <span class="text-[10px] text-zinc-400 font-mono">Bấm 🗑 để dọn thiết bị cũ</span>
            </div>
            <div class="space-y-1">
              ${d.devices.map(dev => {
                const devOnline = dev.status === 'ONLINE';
                const devIdle = dev.status === 'IDLE';
                const devStatusDot = devOnline
                  ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"></span>'
                  : (devIdle ? '<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>' : '<span class="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>');
                const devCompactIp = formatCompactIp(dev.lastIp);
                const devSeen = formatRelativeTime(dev.lastSeenAt);
                return `
                  <div class="flex items-center justify-between p-2 rounded-xl bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/50 dark:border-white/5 text-[11px] font-mono">
                    <div class="flex flex-wrap items-center gap-2 min-w-0">
                      ${devStatusDot}
                      <span class="font-bold text-zinc-800 dark:text-zinc-200" title="${escapeHtml(dev.deviceId)}">#${escapeHtml(dev.deviceId.slice(-6))}</span>
                      <span class="text-zinc-500 dark:text-zinc-400 font-sans">· ${escapeHtml(dev.deviceSummary || 'Web')}</span>
                      <span class="text-zinc-400 font-mono">· ${escapeHtml(devCompactIp)}</span>
                      <span class="text-zinc-400 font-sans text-[10px]">(${devSeen})</span>
                      ${dev.isOwner ? '<span class="text-amber-500 text-[10px]">👑</span>' : ''}
                      ${dev.isBlocked ? '<span class="text-rose-500 text-[10px] font-sans">Đã chặn</span>' : ''}
                    </div>
                    <div class="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        data-action="delete-single-device"
                        data-device-id="${escapeHtml(dev.deviceId)}"
                        class="p-1 rounded text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Xóa thiết bị này (${escapeHtml(dev.deviceId)})"
                      >
                        <i data-lucide="trash" class="w-3 h-3"></i>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Collapsible Past Sessions Accordion Drawer -->
        ${hasPastSessions ? `
          <div class="pt-2 border-t border-zinc-100 dark:border-white/5">
            <button
              type="button"
              data-action="toggle-past-sessions"
              data-target="${drawerId}"
              class="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200/70 dark:hover:bg-white/10 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 transition cursor-pointer select-none"
            >
              <span class="flex items-center gap-1.5">
                <i data-lucide="chevron-right" class="w-3.5 h-3.5 transition-transform duration-200" id="chevron_${drawerId}"></i>
                <span>Lịch sử truy cập (${pastSessions.length} phiên trước · Tổng ${formatDuration(d.totalAccumulatedDurationSec)})</span>
              </span>
              <span class="text-[10px] font-mono text-zinc-400">Xem chi tiết</span>
            </button>
            <div id="${drawerId}" class="hidden space-y-1.5 pt-2 pl-2 border-l-2 border-zinc-200 dark:border-white/10 mt-1">
              ${pastSessions.map((ps, idx) => {
                const psEntered = formatExactClock(ps.enteredAt);
                const psLeft = ps.leftAt ? formatExactClock(ps.leftAt) : '--';
                const psDur = formatDuration(ps.durationSec);
                const psIp = formatCompactIp(ps.ip);
                return `
                  <div class="flex flex-wrap items-center justify-between gap-1 p-2 rounded-lg bg-zinc-100/60 dark:bg-white/5 text-[11px] font-mono">
                    <div class="flex items-center gap-2">
                      <span class="text-zinc-400">#${pastSessions.length - idx}</span>
                      <span class="text-zinc-800 dark:text-zinc-200 font-bold">${psEntered} ➔ ${psLeft}</span>
                      <span class="text-orange-500 dark:text-orange-400">(${psDur})</span>
                      <span class="text-zinc-400" title="${escapeHtml(ps.ip)}">${psIp}</span>
                    </div>
                    <div class="text-zinc-500 dark:text-zinc-400 truncate max-w-[220px]">
                      ${escapeHtml(ps.entryRoute || '#dashboard')} ➔ ${escapeHtml(ps.currentRoute || '#dashboard')}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function renderSessionEventsMarkup(events) {
  if (!events || events.length === 0) {
    return `<div class="py-4 text-center text-zinc-500 text-[11px]">Chưa có sự kiện vào / ra web nào được ghi nhận.</div>`;
  }

  return events.map(ev => {
    let icon = 'activity';
    let iconColor = 'text-emerald-400';
    let badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

    if (ev.eventType === 'ENTER') {
      icon = 'log-in';
      iconColor = 'text-emerald-400';
      badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    } else if (ev.eventType === 'ROUTE_CHANGE') {
      icon = 'shuffle';
      iconColor = 'text-indigo-400';
      badgeClass = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    } else if (ev.eventType === 'LEAVE') {
      icon = 'log-out';
      iconColor = 'text-zinc-400';
      badgeClass = 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30';
    } else if (ev.eventType === 'TIMEOUT') {
      icon = 'timer-off';
      iconColor = 'text-amber-400';
      badgeClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    }

    const timeStr = formatExactClock(ev.timestamp);
    const flag = getCountryFlag(ev.country);

    return `
      <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition">
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="${icon}" class="w-3.5 h-3.5 ${iconColor} shrink-0"></i>
          <span class="text-zinc-400 shrink-0">[${timeStr}]</span>
          <span class="px-1.5 py-0.2 rounded text-[9px] font-bold border ${badgeClass} shrink-0">${ev.eventType}</span>
          <span class="shrink-0">${flag}</span>
          <strong class="text-zinc-200 shrink-0">${escapeHtml(ev.ip)}</strong>
          <span class="text-zinc-400 truncate">${escapeHtml(ev.description)}</span>
        </div>
        <span class="text-[10px] text-zinc-500 shrink-0 hidden sm:inline">${escapeHtml(ev.deviceSummary || '')}</span>
      </div>
    `;
  }).join('');
}

function renderSessionsView() {
  const onlineCount = cachedDevices.filter(d => d.status === 'ONLINE').length;
  const ownerCount = cachedDevices.filter(d => d.isOwner).length;
  const lanCount = cachedDevices.filter(d => d.isLan).length;
  const wanCount = cachedDevices.filter(d => !d.isLan).length;
  const totalCount = cachedDevices.length;

  let filtered = cachedDevices;
  if (activeSessionFilter === 'online') filtered = cachedDevices.filter(d => d.status === 'ONLINE');
  else if (activeSessionFilter === 'owner') filtered = cachedDevices.filter(d => d.isOwner);
  else if (activeSessionFilter === 'lan') filtered = cachedDevices.filter(d => d.isLan);
  else if (activeSessionFilter === 'wan') filtered = cachedDevices.filter(d => !d.isLan);

  if (currentSessionSearch && currentSessionSearch.trim()) {
    const q = currentSessionSearch.toLowerCase().trim();
    filtered = filtered.filter(d =>
      (d.alias && d.alias.toLowerCase().includes(q)) ||
      (d.deviceId && d.deviceId.toLowerCase().includes(q)) ||
      (d.ip && d.ip.toLowerCase().includes(q)) ||
      (d.lastIp && d.lastIp.toLowerCase().includes(q)) ||
      (d.deviceSummary && d.deviceSummary.toLowerCase().includes(q)) ||
      (d.currentRoute && d.currentRoute.toLowerCase().includes(q)) ||
      (d.country && d.country.toLowerCase().includes(q))
    );
  }

  return `
    <div id="subViewSessions" class="${activeSubTab === 'sessions' ? 'space-y-6' : 'hidden space-y-6'}">
      <!-- Live Stats Banner (Device-Centric) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div class="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-white/5 space-y-1 shadow-xs">
          <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span>Đang Online</span>
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
          </div>
          <div id="statSessionsOnline" class="text-2xl font-bold font-mono text-emerald-500">${onlineCount}</div>
          <div class="text-[11px] text-zinc-400">Thiết bị đang mở web</div>
        </div>
        <div class="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-white/5 space-y-1 shadow-xs">
          <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span>Thiết Bị Chủ Nhà</span>
            <span class="text-amber-500 font-bold">👑</span>
          </div>
          <div id="statSessionsOwner" class="text-2xl font-bold font-mono text-amber-500">${ownerCount}</div>
          <div class="text-[11px] text-zinc-400">Đã xác minh Owner</div>
        </div>
        <div class="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-white/5 space-y-1 shadow-xs">
          <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span>Mạng Nội Bộ (LAN)</span>
            <i data-lucide="home" class="w-3.5 h-3.5 text-indigo-400"></i>
          </div>
          <div id="statSessionsLan" class="text-2xl font-bold font-mono text-indigo-400">${lanCount}</div>
          <div class="text-[11px] text-zinc-400">Thiết bị trong nhà</div>
        </div>
        <div class="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-white/5 space-y-1 shadow-xs">
          <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span>Tổng Thiết Bị</span>
            <i data-lucide="smartphone" class="w-3.5 h-3.5 text-orange-400"></i>
          </div>
          <div id="statSessionsTotal" class="text-2xl font-bold font-mono text-orange-400">${totalCount}</div>
          <div class="text-[11px] text-zinc-400">Đã định danh & gom phiên</div>
        </div>
      </div>

      <!-- Controls & Filter Toolbar -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div class="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/5 text-xs font-semibold overflow-x-auto no-scrollbar -mx-1 px-1 sm:mx-0 sm:px-1">
          <button type="button" data-session-filter="all" class="btn-session-filter px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${activeSessionFilter === 'all' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}">
            Tất cả (${cachedDevices.length})
          </button>
          <button type="button" data-session-filter="online" class="btn-session-filter px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${activeSessionFilter === 'online' ? 'bg-emerald-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}">
            🟢 Đang Online (${onlineCount})
          </button>
          <button type="button" data-session-filter="owner" class="btn-session-filter px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${activeSessionFilter === 'owner' ? 'bg-amber-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}">
            👑 Chủ nhà (${ownerCount})
          </button>
          <button type="button" data-session-filter="lan" class="btn-session-filter px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${activeSessionFilter === 'lan' ? 'bg-indigo-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}">
            🏠 LAN (${lanCount})
          </button>
          <button type="button" data-session-filter="wan" class="btn-session-filter px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${activeSessionFilter === 'wan' ? 'bg-sky-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}">
            🌐 WAN (${wanCount})
          </button>
        </div>

        <div class="flex items-center gap-2">
          <div class="relative flex-1 sm:w-64">
            <i data-lucide="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
            <input
              type="text"
              id="inputSearchSessions"
              value="${escapeHtml(currentSessionSearch)}"
              placeholder="Tìm tên, ID, IP, thiết bị..."
              class="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:border-orange-500"
            />
          </div>
          <button
            type="button"
            id="btnPruneDuplicates"
            class="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-orange-500/10 hover:text-orange-500 dark:bg-zinc-800 dark:hover:bg-orange-500/15 dark:hover:text-orange-400 text-zinc-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs active:scale-95 border border-transparent hover:border-orange-500/30"
            title="Dọn sạch các thiết bị rác trùng lặp (giữ lại 3 thiết bị mới nhất mỗi người dùng)"
          >
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-orange-400"></i>
            <span class="hidden sm:inline">Dọn trùng</span>
          </button>
          <button
            type="button"
            id="btnRefreshSessions"
            class="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs active:scale-95"
            title="Làm mới danh sách thiết bị"
          >
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span class="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      <!-- Live Device Cards Container -->
      <div id="sessionsCardsContainer" class="space-y-3 max-h-[580px] overflow-y-auto pr-1">
        ${renderSessionCardsMarkup(filtered)}
      </div>

      <!-- Real-Time Activity Feed -->
      <div class="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-zinc-950/80 border border-white/5 space-y-3 shadow-lg">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
            <h3 class="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">
              Dòng Sự Kiện Vào / Ra Web Trực Tiếp (Live Activity Stream)
            </h3>
            <span id="eventsCountBadge" class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/5 text-zinc-400 border border-white/10">${cachedEvents.length} sự kiện</span>
          </div>
          <button
            type="button"
            id="btnClearSessionEvents"
            class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 text-zinc-400 text-[11px] font-mono transition cursor-pointer flex items-center gap-1 active:scale-95"
            title="Xóa dòng sự kiện"
          >
            <i data-lucide="trash-2" class="w-3 h-3"></i>
            <span>Dọn sạch</span>
          </button>
        </div>
        <div id="sessionEventsLogContainer" class="space-y-1.5 max-h-52 overflow-y-auto font-mono text-[11px] pr-1">
          ${renderSessionEventsMarkup(cachedEvents)}
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the User & IP Traffic Manager markup with sub-tabs
 */
export function renderIpTrafficManager() {
  return `
    <div id="adminIpTrafficContainer" class="space-y-6">
      <!-- Top Card: Summary & Sub-Tab Switcher -->
      <div class="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 backdrop-blur-xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-sky-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <i data-lucide="shield-alert" class="w-5 h-5"></i>
          </div>
          <div>
            <h2 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Quản Trị Người Dùng & Kiểm Soát Truy Cập
              <span id="ipClientsCountBadge" class="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                ${cachedSessions.filter(s => s.status === 'ONLINE').length} online · 0 clients
              </span>
            </h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Theo dõi khách vào/ra web trực tiếp, phân quyền tài khoản, quy tắc chặn IP và giới hạn tần suất yêu cầu (Rate Limit)
            </p>
          </div>
        </div>

        <!-- Sub-Tab Switcher Pills -->
        <div class="w-full sm:w-auto grid grid-cols-3 sm:flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-950/80 border border-zinc-200 dark:border-white/5">
          <button
            type="button"
            id="subTabBtnSessions"
            class="w-full sm:w-auto justify-center px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${activeSubTab === 'sessions' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/50 dark:border-white/10' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}"
          >
            <span class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)] shrink-0"></span>
            <span class="truncate">Khách Vào/Ra (Live)</span>
          </button>
          <button
            type="button"
            id="subTabBtnTraffic"
            class="w-full sm:w-auto justify-center px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${activeSubTab === 'traffic' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/50 dark:border-white/10' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}"
          >
            <i data-lucide="network" class="w-3.5 h-3.5 text-orange-500 shrink-0"></i>
            <span class="truncate">Lưu Lượng & Quy Tắc IP</span>
          </button>
          <button
            type="button"
            id="subTabBtnUsers"
            class="w-full sm:w-auto justify-center px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${activeSubTab === 'users' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/50 dark:border-white/10' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}"
          >
            <i data-lucide="users" class="w-3.5 h-3.5 text-orange-500 shrink-0"></i>
            <span class="truncate">Tài Khoản Người Dùng</span>
          </button>
        </div>
      </div>

      <!-- VIEW 0: Live Visitor Sessions ("Vào web ra web cũng log được") -->
      ${renderSessionsView()}

      <!-- VIEW 1: IP Traffic & Access Rules -->
      <div id="subViewIpTraffic" class="${activeSubTab === 'traffic' ? 'space-y-6' : 'hidden space-y-6'}">
        <!-- Filters & Action Bar -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <!-- Filter Pills -->
          <div class="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/5 text-xs font-semibold overflow-x-auto no-scrollbar -mx-1 px-1 sm:mx-0 sm:px-1">
            <button
              type="button"
              data-ip-filter="all"
              class="btn-ip-filter px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${activeFilter === 'all' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
            >
              Tất cả
            </button>
            <button
              type="button"
              data-ip-filter="lan"
              class="btn-ip-filter px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${activeFilter === 'lan' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
            >
              Mạng LAN
            </button>
            <button
              type="button"
              data-ip-filter="wan"
              class="btn-ip-filter px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${activeFilter === 'wan' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
            >
              Internet (WAN)
            </button>
            <button
              type="button"
              data-ip-filter="blocked"
              class="btn-ip-filter px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${activeFilter === 'blocked' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
            >
              Đang Chặn
            </button>
            <button
              type="button"
              data-ip-filter="rate_limited"
              class="btn-ip-filter px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${activeFilter === 'rate_limited' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
            >
              Đang Giới Hạn (RPM)
            </button>
            <button
              type="button"
              data-ip-filter="errors"
              class="btn-ip-filter px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${activeFilter === 'errors' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
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
 * Modal to set or update a device alias
 */
function openDeviceAliasModal(deviceId, currentAlias, onSuccess) {
  const modalId = 'modalDeviceAlias';
  const oldModal = document.getElementById(modalId);
  if (oldModal) oldModal.remove();

  const html = `
    <div id="${modalId}" class="fixed inset-0 z-[9998] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div class="relative w-full max-w-sm rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#111114] p-5 sm:p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
              <i data-lucide="tag" class="w-4 h-4"></i>
            </div>
            <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
              Đặt Tên Gợi Nhớ Thiết Bị
            </h3>
          </div>
          <button type="button" id="btnCloseDeviceAliasModal" class="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-xl cursor-pointer">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <form id="formDeviceAlias" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Mã thiết bị (Device ID)</label>
            <input
              type="text"
              value="${escapeHtml(deviceId)}"
              readonly
              class="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 font-mono text-[11px]"
            />
          </div>

          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tên gợi nhớ (Biệt danh)</label>
            <input
              type="text"
              id="inputDeviceAliasValue"
              value="${escapeHtml(currentAlias || '')}"
              placeholder="ví dụ: PC của Duy, Xiaomi 15T Pro..."
              class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-white/5">
            <button
              type="button"
              id="btnCancelDeviceAliasModal"
              class="px-3 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer font-medium"
            >
              Hủy
            </button>
            <button
              type="submit"
              class="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition cursor-pointer shadow-xs active:scale-95"
            >
              Lưu tên
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
  if (window.lucide) window.lucide.createIcons();

  const modalEl = document.getElementById(modalId);
  const formEl = document.getElementById('formDeviceAlias');
  const inputEl = document.getElementById('inputDeviceAliasValue');
  const btnClose = document.getElementById('btnCloseDeviceAliasModal');
  const btnCancel = document.getElementById('btnCancelDeviceAliasModal');

  const closeModal = () => modalEl && modalEl.remove();

  if (btnClose) btnClose.onclick = closeModal;
  if (btnCancel) btnCancel.onclick = closeModal;

  if (inputEl) {
    inputEl.focus();
    inputEl.select();
  }

  if (formEl) {
    formEl.onsubmit = async (e) => {
      e.preventDefault();
      const newAlias = inputEl.value.trim();
      try {
        const res = await fetch(`/api/v1/admin/traffic/devices/${encodeURIComponent(deviceId)}/alias`, {
          method: 'POST',
          headers: { ...getStorageAuthHeaders(), 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ alias: newAlias })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Không thể lưu tên gợi nhớ');
        showToast(json.message || 'Đã lưu tên gợi nhớ', 'success');
        closeModal();
        if (onSuccess) onSuccess();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }
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

  const subTabBtnSessions = containerEl.querySelector('#subTabBtnSessions');
  const subTabBtnTraffic = containerEl.querySelector('#subTabBtnTraffic');
  const subTabBtnUsers = containerEl.querySelector('#subTabBtnUsers');
  const subViewSessions = containerEl.querySelector('#subViewSessions');
  const subViewTraffic = containerEl.querySelector('#subViewIpTraffic');
  const subViewUsers = containerEl.querySelector('#subViewUserAccounts');

  let sessionsPollTimer = null;
  let sessionsVisibilityHandler = null;
  const isMobileOrApk = typeof window !== 'undefined' && (Boolean(window.AndroidBridge) || /Android|iPhone|iPad|iPod/i.test(navigator?.userAgent || ''));
  const sessionsIntervalMs = isMobileOrApk ? 16000 : 8000;

  const stopSessionsPolling = () => {
    if (sessionsPollTimer) {
      clearInterval(sessionsPollTimer);
      sessionsPollTimer = null;
    }
    if (sessionsVisibilityHandler) {
      document.removeEventListener('visibilitychange', sessionsVisibilityHandler);
      window.removeEventListener('ds:visibility-change', sessionsVisibilityHandler);
      window.removeEventListener('ds:native-app-paused', stopSessionsPolling);
      sessionsVisibilityHandler = null;
    }
  };

  const startSessionsPolling = () => {
    stopSessionsPolling();
    sessionsPollTimer = setInterval(() => {
      if (document.hidden || document.visibilityState === 'hidden') return;
      if (activeSubTab === 'sessions' && document.contains(containerEl)) {
        fetchAndRenderSessionsData(true);
      } else {
        stopSessionsPolling();
      }
    }, sessionsIntervalMs);

    let lastResumeFetch = 0;
    sessionsVisibilityHandler = (e) => {
      const isHidden = document.hidden || document.visibilityState === 'hidden' || Boolean(e?.detail?.hidden);
      if (isHidden) {
        if (sessionsPollTimer) {
          clearInterval(sessionsPollTimer);
          sessionsPollTimer = null;
        }
      } else {
        if (activeSubTab === 'sessions' && document.contains(containerEl)) {
          const now = Date.now();
          if (now - lastResumeFetch >= 15000) {
            lastResumeFetch = now;
            fetchAndRenderSessionsData(true);
          }
          if (!sessionsPollTimer) {
            startSessionsPolling();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', sessionsVisibilityHandler);
    window.addEventListener('ds:visibility-change', sessionsVisibilityHandler);
    window.addEventListener('ds:native-app-paused', stopSessionsPolling);
  };

  const activeTabClasses = 'w-full sm:w-auto justify-center px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/50 dark:border-white/10';
  const inactiveTabClasses = 'w-full sm:w-auto justify-center px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200';

  // Sub-tab toggling
  const switchSubTab = (tab) => {
    activeSubTab = tab;

    if (subTabBtnSessions) subTabBtnSessions.className = tab === 'sessions' ? activeTabClasses : inactiveTabClasses;
    if (subTabBtnTraffic) subTabBtnTraffic.className = tab === 'traffic' ? activeTabClasses : inactiveTabClasses;
    if (subTabBtnUsers) subTabBtnUsers.className = tab === 'users' ? activeTabClasses : inactiveTabClasses;

    if (subViewSessions) subViewSessions.classList.toggle('hidden', tab !== 'sessions');
    if (subViewTraffic) subViewTraffic.classList.toggle('hidden', tab !== 'traffic');
    if (subViewUsers) subViewUsers.classList.toggle('hidden', tab !== 'users');

    if (tab === 'sessions') {
      fetchAndRenderSessionsData();
      startSessionsPolling();
    } else {
      stopSessionsPolling();
      if (tab === 'traffic') {
        fetchAndRenderIpData();
      } else if (tab === 'users') {
        attachUsersManagerListeners();
      }
    }
  };

  if (subTabBtnSessions) subTabBtnSessions.onclick = () => switchSubTab('sessions');
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

  // ===================== SESSIONS TAB LOGIC =====================
  const btnPruneDuplicates = containerEl.querySelector('#btnPruneDuplicates');
  const btnRefreshSessions = containerEl.querySelector('#btnRefreshSessions');
  const inputSearchSessions = containerEl.querySelector('#inputSearchSessions');
  const sessionFilterButtons = containerEl.querySelectorAll('.btn-session-filter');
  const btnClearSessionEvents = containerEl.querySelector('#btnClearSessionEvents');
  const sessionsCardsContainer = containerEl.querySelector('#sessionsCardsContainer');

  const fetchAndRenderSessionsData = async (isSilent = false) => {
    try {
      const [respDevices, respEvents] = await Promise.all([
        fetch('/api/v1/admin/traffic/devices', { headers: { ...getStorageAuthHeaders(), Accept: 'application/json' } }),
        fetch('/api/v1/admin/traffic/events', { headers: { ...getStorageAuthHeaders(), Accept: 'application/json' } })
      ]);

      const jsonDevices = await respDevices.json();
      const jsonEvents = await respEvents.json();

      if (jsonDevices.success && jsonDevices.data) {
        cachedDevices = Array.isArray(jsonDevices.data.devices) ? jsonDevices.data.devices : [];
      }
      if (jsonEvents.success && Array.isArray(jsonEvents.data)) {
        cachedEvents = jsonEvents.data;
      }

      applySessionFiltersAndRender();
      updateSessionStatsDom();
    } catch (err) {
      if (!isSilent) {
        console.error('[AdminIpTraffic] Failed to fetch device session data:', err);
      }
    }
  };

  const updateSessionStatsDom = () => {
    const elOnline = containerEl.querySelector('#statSessionsOnline');
    const elOwner = containerEl.querySelector('#statSessionsOwner');
    const elLan = containerEl.querySelector('#statSessionsLan');
    const elTotal = containerEl.querySelector('#statSessionsTotal');
    const elBadge = containerEl.querySelector('#ipClientsCountBadge');
    const elEventsBadge = containerEl.querySelector('#eventsCountBadge');

    const onlineCount = cachedDevices.filter(d => d.status === 'ONLINE').length;
    const ownerCount = cachedDevices.filter(d => d.isOwner).length;
    const lanCount = cachedDevices.filter(d => d.isLan).length;
    const wanCount = cachedDevices.filter(d => !d.isLan).length;
    const totalCount = cachedDevices.length;

    if (elOnline) elOnline.textContent = onlineCount;
    if (elOwner) elOwner.textContent = ownerCount;
    if (elLan) elLan.textContent = lanCount;
    if (elTotal) elTotal.textContent = totalCount;

    if (elBadge) {
      elBadge.textContent = `${onlineCount} online · ${totalCount} thiết bị`;
    }
    if (elEventsBadge) {
      elEventsBadge.textContent = `${cachedEvents.length} sự kiện`;
    }

    sessionFilterButtons.forEach(btn => {
      const f = btn.dataset.sessionFilter;
      if (f === 'all') btn.textContent = `Tất cả (${totalCount})`;
      else if (f === 'online') btn.textContent = `🟢 Đang Online (${onlineCount})`;
      else if (f === 'owner') btn.textContent = `👑 Chủ nhà (${ownerCount})`;
      else if (f === 'lan') btn.textContent = `🏠 LAN (${lanCount})`;
      else if (f === 'wan') btn.textContent = `🌐 WAN (${wanCount})`;
    });

    const eventsContainer = containerEl.querySelector('#sessionEventsLogContainer');
    if (eventsContainer) {
      eventsContainer.innerHTML = renderSessionEventsMarkup(cachedEvents);
      if (window.lucide) window.lucide.createIcons();
    }
  };

  const applySessionFiltersAndRender = () => {
    let filtered = cachedDevices;
    if (activeSessionFilter === 'online') filtered = cachedDevices.filter(d => d.status === 'ONLINE');
    else if (activeSessionFilter === 'owner') filtered = cachedDevices.filter(d => d.isOwner);
    else if (activeSessionFilter === 'lan') filtered = cachedDevices.filter(d => d.isLan);
    else if (activeSessionFilter === 'wan') filtered = cachedDevices.filter(d => !d.isLan);

    if (currentSessionSearch && currentSessionSearch.trim()) {
      const q = currentSessionSearch.toLowerCase().trim();
      filtered = filtered.filter(d =>
        (d.alias && d.alias.toLowerCase().includes(q)) ||
        (d.deviceId && d.deviceId.toLowerCase().includes(q)) ||
        (d.ip && d.ip.toLowerCase().includes(q)) ||
        (d.lastIp && d.lastIp.toLowerCase().includes(q)) ||
        (d.deviceSummary && d.deviceSummary.toLowerCase().includes(q)) ||
        (d.currentRoute && d.currentRoute.toLowerCase().includes(q)) ||
        (d.country && d.country.toLowerCase().includes(q))
      );
    }

    if (sessionsCardsContainer) {
      sessionsCardsContainer.innerHTML = renderSessionCardsMarkup(filtered);
      if (window.lucide) window.lucide.createIcons();
    }
  };

  if (btnPruneDuplicates) {
    btnPruneDuplicates.onclick = async () => {
      if (!confirm('Bạn có chắc muốn dọn sạch các thiết bị rác trùng lặp của cùng một người dùng? (Giữ lại tối đa 3 thiết bị mới nhất mỗi người dùng)')) return;
      btnPruneDuplicates.disabled = true;
      btnPruneDuplicates.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>';
      if (window.lucide) window.lucide.createIcons();
      try {
        const res = await fetch('/api/v1/admin/traffic/devices/prune-duplicates', {
          method: 'POST',
          headers: { ...getStorageAuthHeaders(), 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ keepLatest: 3 })
        });
        const json = await res.json();
        showToast(json.message || 'Đã dọn dẹp thiết bị trùng', json.success ? 'success' : 'error');
        await fetchAndRenderSessionsData();
      } catch (err) {
        showToast(`Lỗi dọn trùng: ${err.message}`, 'error');
      } finally {
        btnPruneDuplicates.disabled = false;
        btnPruneDuplicates.innerHTML = '<i data-lucide="sparkles" class="w-3.5 h-3.5 text-orange-400"></i> <span class="hidden sm:inline">Dọn trùng</span>';
        if (window.lucide) window.lucide.createIcons();
      }
    };
  }

  if (btnRefreshSessions) {
    btnRefreshSessions.onclick = async () => {
      btnRefreshSessions.disabled = true;
      btnRefreshSessions.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>';
      if (window.lucide) window.lucide.createIcons();
      await fetchAndRenderSessionsData();
      btnRefreshSessions.disabled = false;
      btnRefreshSessions.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> <span class="hidden sm:inline">Làm mới</span>';
      if (window.lucide) window.lucide.createIcons();
      showToast('Đã làm mới danh sách thiết bị và phiên truy cập', 'info');
    };
  }

  if (inputSearchSessions) {
    inputSearchSessions.oninput = (e) => {
      currentSessionSearch = e.target.value;
      applySessionFiltersAndRender();
    };
  }

  sessionFilterButtons.forEach(btn => {
    btn.onclick = () => {
      activeSessionFilter = btn.dataset.sessionFilter;
      sessionFilterButtons.forEach(b => {
        const isCurrent = b.dataset.sessionFilter === activeSessionFilter;
        let activeBg = 'bg-orange-500';
        if (activeSessionFilter === 'online') activeBg = 'bg-emerald-500';
        else if (activeSessionFilter === 'owner') activeBg = 'bg-amber-500';
        else if (activeSessionFilter === 'lan') activeBg = 'bg-indigo-500';
        else if (activeSessionFilter === 'wan') activeBg = 'bg-sky-500';

        b.className = `btn-session-filter px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${
          isCurrent ? `${activeBg} text-white shadow-xs` : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
        }`;
      });
      applySessionFiltersAndRender();
    };
  });

  if (btnClearSessionEvents) {
    btnClearSessionEvents.onclick = async () => {
      if (!confirm('Bạn có chắc muốn xóa sạch toàn bộ dòng sự kiện vào / ra web?')) return;
      try {
        const res = await fetch('/api/v1/admin/traffic/events/clear', {
          method: 'POST',
          headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
        });
        const json = await res.json();
        showToast(json.message || 'Đã dọn sạch dòng sự kiện', json.success ? 'success' : 'error');
        fetchAndRenderSessionsData();
      } catch (err) {
        showToast(`Lỗi khi dọn dòng sự kiện: ${err.message}`, 'error');
      }
    };
  }

  if (sessionsCardsContainer) {
    sessionsCardsContainer.onclick = async (e) => {
      // 1. Rename Device Alias
      const renameBtn = e.target.closest('[data-action="rename-device"]');
      if (renameBtn) {
        const deviceId = renameBtn.dataset.deviceId;
        const currentAlias = renameBtn.dataset.alias;
        openDeviceAliasModal(deviceId, currentAlias, () => fetchAndRenderSessionsData());
        return;
      }

      // 2. Toggle Owner Status
      const ownerBtn = e.target.closest('[data-action="toggle-owner"]');
      if (ownerBtn) {
        const deviceId = ownerBtn.dataset.deviceId;
        const isOwner = ownerBtn.dataset.isOwner === 'true';
        const newOwner = !isOwner;
        try {
          const res = await fetch(`/api/v1/admin/traffic/devices/${encodeURIComponent(deviceId)}/set-owner`, {
            method: 'POST',
            headers: { ...getStorageAuthHeaders(), 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ isOwner: newOwner })
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.message || 'Thao tác thất bại');
          showToast(json.message || (newOwner ? 'Đã gán quyền Chủ nhà cho thiết bị' : 'Đã bỏ quyền Chủ nhà'), 'success');
          fetchAndRenderSessionsData();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 3. Toggle Device Block
      const blockDevBtn = e.target.closest('[data-action="toggle-device-block"]');
      if (blockDevBtn) {
        const deviceId = blockDevBtn.dataset.deviceId;
        const isBlocked = blockDevBtn.dataset.blocked === 'true';
        const newBlocked = !isBlocked;
        const label = newBlocked ? 'chặn hoàn toàn thiết bị này' : 'bỏ chặn thiết bị này';
        if (!confirm(`Bạn có chắc muốn ${label}?`)) return;

        try {
          const res = await fetch(`/api/v1/admin/traffic/devices/${encodeURIComponent(deviceId)}/toggle-block`, {
            method: 'POST',
            headers: { ...getStorageAuthHeaders(), 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ blocked: newBlocked })
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.message || 'Thao tác thất bại');
          showToast(json.message || (newBlocked ? 'Đã chặn thiết bị' : 'Đã bỏ chặn thiết bị'), 'success');
          fetchAndRenderSessionsData();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 3.5. Toggle Sub-Devices Drawer
      const toggleDevBtn = e.target.closest('[data-action="toggle-devices-drawer"]');
      if (toggleDevBtn) {
        const targetId = toggleDevBtn.dataset.target;
        const drawerEl = document.getElementById(targetId);
        const chevronEl = document.getElementById(`chevron_${targetId}`);
        if (drawerEl) {
          drawerEl.classList.toggle('hidden');
          if (chevronEl) chevronEl.classList.toggle('rotate-180');
        }
        return;
      }

      // 3.6. Delete Single Device
      const delSingleDevBtn = e.target.closest('[data-action="delete-single-device"]');
      if (delSingleDevBtn) {
        const deviceId = delSingleDevBtn.dataset.deviceId;
        if (!confirm(`Bạn có chắc muốn xóa thiết bị #${deviceId.slice(-6)}?`)) return;
        try {
          const res = await fetch(`/api/v1/admin/traffic/devices/${encodeURIComponent(deviceId)}`, {
            method: 'DELETE',
            headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
          });
          const json = await res.json();
          showToast(json.message || 'Đã xóa thiết bị', json.success ? 'success' : 'error');
          fetchAndRenderSessionsData();
        } catch (err) {
          showToast(`Lỗi khi xóa thiết bị: ${err.message}`, 'error');
        }
        return;
      }

      // 3.7. Delete User & All Linked Devices
      const delUserBtn = e.target.closest('[data-action="delete-user-devices"]');
      if (delUserBtn) {
        const userIdentifier = delUserBtn.dataset.userIdentifier;
        const userName = delUserBtn.dataset.userName || 'người dùng';
        if (!confirm(`Bạn có chắc muốn xóa toàn bộ thiết bị của "${userName}"?`)) return;
        try {
          const res = await fetch(`/api/v1/admin/traffic/users/${encodeURIComponent(userIdentifier)}`, {
            method: 'DELETE',
            headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
          });
          const json = await res.json();
          showToast(json.message || 'Đã xóa người dùng', json.success ? 'success' : 'error');
          fetchAndRenderSessionsData();
        } catch (err) {
          showToast(`Lỗi khi xóa người dùng: ${err.message}`, 'error');
        }
        return;
      }

      // 4. Toggle Collapsible Past Sessions
      const togglePastBtn = e.target.closest('[data-action="toggle-past-sessions"]');
      if (togglePastBtn) {
        const targetId = togglePastBtn.dataset.target;
        const drawerEl = document.getElementById(targetId);
        const chevronEl = document.getElementById(`chevron_${targetId}`);
        if (drawerEl) {
          drawerEl.classList.toggle('hidden');
          if (chevronEl) {
            chevronEl.classList.toggle('rotate-90');
          }
        }
        return;
      }

      // 5. Copy Text (IP) to Clipboard
      const copyBtn = e.target.closest('[data-action="copy-text"]');
      if (copyBtn) {
        const text = copyBtn.dataset.copyText;
        if (text) {
          try {
            await navigator.clipboard.writeText(text);
            showToast(`Đã sao chép: ${text}`, 'success');
          } catch {
            showToast('Không thể sao chép vào bộ nhớ tạm', 'error');
          }
        }
        return;
      }

      // 6. Inspect IP Logs
      const inspectBtn = e.target.closest('[data-inspect-session-ip]');
      if (inspectBtn) {
        openIpRequestLogsDrawer(inspectBtn.dataset.inspectSessionIp);
        return;
      }

      // 7. Block IP
      const blockBtn = e.target.closest('[data-session-toggle-block]');
      if (blockBtn) {
        const ip = blockBtn.dataset.sessionToggleBlock;
        if (!confirm(`Bạn có chắc muốn chặn hoàn toàn IP '${ip}'?`)) return;
        try {
          const res = await fetch(`/api/v1/admin/traffic/ips/${encodeURIComponent(ip)}/toggle-block`, {
            method: 'POST',
            headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
          });
          const json = await res.json();
          showToast(json.message || `Đã cập nhật quy tắc cho ${ip}`, json.success ? 'success' : 'error');
          fetchAndRenderSessionsData();
        } catch (err) {
          showToast(`Lỗi khi chặn IP: ${err.message}`, 'error');
        }
      }
    };
  }

  // Initial load
  if (activeSubTab === 'sessions') {
    fetchAndRenderSessionsData();
    startSessionsPolling();
  } else if (activeSubTab === 'traffic') {
    fetchAndRenderIpData();
  } else {
    attachUsersManagerListeners();
  }
}
