/**
 * AdminPage.js - Admin Control Center & Telemetry Dashboard (#admin)
 * Comprehensive system, network traffic, hardware, BullMQ, Cloudflare R2, and AI rate limits monitoring.
 */

import {
  isAdminAuthenticated,
  verifyAdminPassword,
  lockAdminSession,
  showChangePasswordModal,
  getStorageAuthHeaders
} from '../utilities/adminAuth.js';
import { showToast } from '../utilities/toast.js';
import { clearAllModuleStates } from '../utilities/moduleState.js';
import { renderSvgGauge, drawSparklineCanvas } from '../components/admin/AdminVisualizers.js';
import { renderAiAgentsCard, attachAiAgentsListeners } from '../components/admin/AdminAiAgentsCard.js';

// Module state for polling ticker and data cache
let telemetryPollingTimer = null;
let isPollingPaused = false;
let latestTelemetryData = null;
let trafficHistoryRps = [];

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds) {
  if (!seconds || isNaN(seconds)) return '0m';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Renders the Admin Page HTML
 */
export function renderAdminPage() {
  const isAuth = isAdminAuthenticated();

  if (!isAuth) {
    return renderLockedAdminView();
  }

  return renderUnlockedDashboardView();
}

/**
 * Locked State View - Secure Administrator Unlock
 */
function renderLockedAdminView() {
  return `
    <div class="min-h-[75vh] flex items-center justify-center p-4 animate-fadeIn">
      <div class="w-full max-w-md p-8 rounded-3xl bg-zinc-900/80 border border-white/10 backdrop-blur-xl shadow-2xl text-center space-y-6">
        <div class="relative mx-auto w-16 h-16 flex items-center justify-center">
          <div class="absolute inset-0 rounded-2xl bg-orange-500/20 blur-xl"></div>
          <img
            src="src/assets/branding/duydev-04c3-solid-faceted.svg?v=22.12"
            alt="DuyDev Studio"
            class="w-14 h-14 relative z-10 drop-shadow-md"
          />
        </div>

        <div>
          <h2 class="text-xl font-bold text-zinc-100 flex items-center justify-center gap-2">
            Trung Tâm Quản Trị Hệ Thống
          </h2>
          <p class="text-xs text-zinc-400 mt-1.5">
            Nhập mật khẩu quản trị viên để mở khóa dashboard telemetry và giám sát hạn ngạch AI Agents.
          </p>
        </div>

        <div class="space-y-3 text-left">
          <label for="adminPagePwdInput" class="text-xs font-semibold text-zinc-300">Mật khẩu Quản trị</label>
          <div class="relative">
            <input
              type="password"
              id="adminPagePwdInput"
              autocomplete="current-password"
              placeholder="Nhập mật khẩu..."
              class="w-full px-4 py-3 rounded-xl bg-zinc-950/70 border border-white/10 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-zinc-100 text-sm placeholder-zinc-600 outline-none transition font-mono"
            />
          </div>
          <p id="adminPageErrorText" class="hidden text-xs text-rose-400 mt-1 flex items-center gap-1 font-medium">
            <i data-lucide="alert-circle" class="w-3.5 h-3.5 inline"></i> Mật khẩu quản trị không chính xác
          </p>
        </div>

        <button
          id="btnAdminPageUnlock"
          class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold text-sm shadow-lg shadow-orange-500/25 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
        >
          <i data-lucide="shield-check" class="w-4 h-4"></i>
          <span>Mở Khóa Quản Trị</span>
        </button>

        <div class="pt-2 border-t border-white/5">
          <a href="#settings" class="text-xs text-zinc-500 hover:text-zinc-300 transition">
            Quay lại Cài đặt
          </a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Unlocked Dashboard View - 5 Core Telemetry Pillars
 */
function renderUnlockedDashboardView() {
  const d = latestTelemetryData || {};
  const host = d.host || {};
  const mem = host.memory || {};
  const procMem = host.processMemory || {};
  const loadAvg = host.loadAverage || [0, 0, 0];
  const storage = d.storage || {};
  const storageBreakdown = storage.breakdown || {};
  const db = storage.database || {};
  const dbRecords = db.records || {};
  const redis = storage.redis || {};
  const queues = d.queues || {};
  const cloudflare = d.cloudflare || {};
  const r2 = cloudflare.r2 || {};
  const traffic = d.traffic || {};
  const trafficSummary = traffic.summary || {};
  const codes = traffic.statusCodes || {};

  return `
    <div class="max-w-7xl mx-auto space-y-6 pb-12 animate-fadeIn">
      <!-- 1. Top Header & Control Bar -->
      <div class="p-6 rounded-3xl bg-zinc-900/60 border border-white/5 backdrop-blur-xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 flex items-center justify-center">
            <img
              src="src/assets/branding/duydev-04c3-solid-faceted.svg?v=22.12"
              alt="DuyDev Studio Logo"
              class="w-8 h-8 drop-shadow"
            />
          </div>
          <div>
            <h1 class="text-lg sm:text-xl font-bold text-zinc-100 flex items-center gap-2">
              Admin Control Center
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                ONLINE
              </span>
            </h1>
            <div class="text-xs text-zinc-400 font-mono mt-0.5 flex flex-wrap items-center gap-3">
              <span>Host: <span class="text-zinc-200">${host.hostname || 'Homeserver'}</span></span>
              <span>Uptime: <span class="text-zinc-200">${formatUptime(d.uptimeSeconds)}</span></span>
              <span>CPU: <span class="text-zinc-200">${host.cpuCores || 4} cores</span></span>
              <span>Tunnel: <span class="text-orange-400 font-semibold">HTTP/2</span></span>
            </div>
          </div>
        </div>

        <!-- Action Pills -->
        <div class="flex flex-wrap items-center gap-2.5">
          <button
            id="btnToggleAdminTicker"
            class="px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span class="w-2 h-2 rounded-full ${isPollingPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}"></span>
            <span id="adminTickerText">${isPollingPaused ? 'Tiếp tục 3s' : 'Đang trực tiếp 3s'}</span>
          </button>

          <button
            id="btnManualRefreshAdmin"
            class="px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Làm mới ngay"
          >
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Làm mới</span>
          </button>

          <button
            id="btnAdminChangePwd"
            class="px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <i data-lucide="key" class="w-3.5 h-3.5"></i>
            <span>Đổi mật khẩu</span>
          </button>

          <button
            id="btnAdminLockSession"
            class="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <i data-lucide="lock" class="w-3.5 h-3.5"></i>
            <span>Khóa phiên</span>
          </button>
        </div>
      </div>

      <!-- 2. Top 5 KPI Summary Banner -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <!-- KPI 1: Live RPS & Bandwidth -->
        <div class="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 backdrop-blur-md">
          <div class="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span>Lưu Lượng Mạng</span>
            <i data-lucide="activity" class="w-4 h-4 text-orange-400"></i>
          </div>
          <div class="text-xl font-bold font-mono text-zinc-100">
            ${trafficSummary.liveRps || 0} <span class="text-xs font-sans font-normal text-zinc-400">RPS</span>
          </div>
          <div class="text-[11px] font-mono text-zinc-400 mt-1">
            ↓ ${(trafficSummary.kbInPerSec || 0).toFixed(1)} KB/s · ↑ ${(trafficSummary.kbOutPerSec || 0).toFixed(1)} KB/s
          </div>
        </div>

        <!-- KPI 2: Host RAM -->
        <div class="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 backdrop-blur-md">
          <div class="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span>Bộ Nhớ RAM</span>
            <i data-lucide="cpu" class="w-4 h-4 text-emerald-400"></i>
          </div>
          <div class="text-xl font-bold font-mono text-zinc-100">
            ${mem.percent || 0}% <span class="text-xs font-sans font-normal text-zinc-400">đang dùng</span>
          </div>
          <div class="text-[11px] font-mono text-zinc-400 mt-1">
            ${((mem.usedMb || 0) / 1024).toFixed(1)} GB / ${((mem.totalMb || 0) / 1024).toFixed(1)} GB
          </div>
        </div>

        <!-- KPI 3: CPU Load -->
        <div class="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 backdrop-blur-md">
          <div class="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span>Tải CPU (Load)</span>
            <i data-lucide="zap" class="w-4 h-4 text-amber-400"></i>
          </div>
          <div class="text-xl font-bold font-mono text-zinc-100">
            ${loadAvg[0] || '0.00'} <span class="text-xs font-sans font-normal text-zinc-400">1m avg</span>
          </div>
          <div class="text-[11px] font-mono text-zinc-400 mt-1">
            5m: ${loadAvg[1] || '0.00'} · 15m: ${loadAvg[2] || '0.00'}
          </div>
        </div>

        <!-- KPI 4: Disk Storage -->
        <div class="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 backdrop-blur-md">
          <div class="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span>Ổ Đĩa Lưu Trữ</span>
            <i data-lucide="hard-drive" class="w-4 h-4 text-cyan-400"></i>
          </div>
          <div class="text-xl font-bold font-mono text-zinc-100">
            ${storage.totalMb || 0} <span class="text-xs font-sans font-normal text-zinc-400">MB</span>
          </div>
          <div class="text-[11px] font-mono text-zinc-400 mt-1">
            ${storage.totalFiles || 0} tệp trong kho
          </div>
        </div>

        <!-- KPI 5: AI Engine Token -->
        <div class="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 backdrop-blur-md col-span-2 sm:col-span-1">
          <div class="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span>AI Agnes Token</span>
            <i data-lucide="bot" class="w-4 h-4 text-orange-400"></i>
          </div>
          <div class="text-xl font-bold font-mono text-zinc-100">
            ${(d.ai?.rateLimits?.liveRpm || 0)} <span class="text-xs font-sans font-normal text-zinc-400">RPM</span>
          </div>
          <div class="text-[11px] font-mono text-zinc-400 mt-1">
            Hôm nay: ${d.ai?.rateLimits?.dailyCalls || 0} calls (${((d.ai?.rateLimits?.dailyTokens || 0) / 1000).toFixed(1)}k)
          </div>
        </div>
      </div>

      <!-- 3. Detail Grid: 4 Core Hardware & Queue Panels -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Panel 1: Live Network Traffic Sparkline & HTTP Codes -->
        <div class="p-6 rounded-3xl bg-zinc-900/60 border border-white/5 backdrop-blur-xl shadow-xl space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <i data-lucide="radio" class="w-4 h-4 text-orange-400"></i>
              Lưu Lượng Mạng Thời Gian Thực (60s)
            </h3>
            <span class="text-xs font-mono text-zinc-400">
              Tổng: ${(trafficSummary.totalRequests || 0).toLocaleString()} reqs
            </span>
          </div>

          <!-- Canvas Sparkline -->
          <div class="relative w-full h-28 rounded-2xl bg-zinc-950/60 border border-white/5 p-2 overflow-hidden">
            <canvas id="adminTrafficSparkline" class="w-full h-full"></canvas>
          </div>

          <!-- Status Code Distribution -->
          <div class="grid grid-cols-4 gap-2 text-center text-xs font-mono">
            <div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <div class="text-base font-bold">${codes.c2xx || 0}</div>
              <div class="text-[10px] uppercase font-sans text-emerald-500">2xx Thành công</div>
            </div>
            <div class="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <div class="text-base font-bold">${codes.c3xx || 0}</div>
              <div class="text-[10px] uppercase font-sans text-sky-500">3xx Chuyển hướng</div>
            </div>
            <div class="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <div class="text-base font-bold">${codes.c4xx || 0}</div>
              <div class="text-[10px] uppercase font-sans text-amber-500">4xx Client Lỗi</div>
            </div>
            <div class="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <div class="text-base font-bold">${codes.c5xx || 0}</div>
              <div class="text-[10px] uppercase font-sans text-rose-500">5xx Server Lỗi</div>
            </div>
          </div>

          <!-- LAN vs WAN Split -->
          <div class="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-white/5">
            <span>Phân luồng: LAN <strong class="text-zinc-200 font-mono">${trafficSummary.lanRequests || 0}</strong></span>
            <span>Cloudflare WAN <strong class="text-orange-400 font-mono">${trafficSummary.wanRequests || 0}</strong></span>
            <span>Băng thông vào: <strong class="text-zinc-200 font-mono">${formatBytes(trafficSummary.totalBytesIn)}</strong></span>
            <span>Băng thông ra: <strong class="text-zinc-200 font-mono">${formatBytes(trafficSummary.totalBytesOut)}</strong></span>
          </div>
        </div>

        <!-- Panel 2: Memory & Hardware Gauges -->
        <div class="p-6 rounded-3xl bg-zinc-900/60 border border-white/5 backdrop-blur-xl shadow-xl space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <i data-lucide="gauge" class="w-4 h-4 text-emerald-400"></i>
              Tài Nguyên & Bộ Nhớ Máy Chủ
            </h3>
            <span class="text-xs font-mono text-zinc-400">${host.platform || 'linux'} (${host.arch || 'x64'})</span>
          </div>

          <!-- Gauges Row -->
          <div class="grid grid-cols-3 gap-3">
            ${renderSvgGauge(mem.percent || 0, 'Host RAM', `${mem.percent || 0}%`, 'auto')}
            ${renderSvgGauge(Math.min(100, Math.round(((loadAvg[0] || 0) / (host.cpuCores || 4)) * 100)), 'Tải CPU', `${Math.round(((loadAvg[0] || 0) / (host.cpuCores || 4)) * 100)}%`, 'auto')}
            ${renderSvgGauge(r2.percentUsed || 0, 'Cloudflare R2', `${r2.percentUsed || 0}%`, 'orange')}
          </div>

          <!-- Details Breakdown -->
          <div class="space-y-2 text-xs text-zinc-400 font-mono pt-2 border-t border-white/5">
            <div class="flex justify-between">
              <span>Node.js Process RSS / Heap:</span>
              <span class="text-zinc-200 font-bold">${procMem.rssMb || 0} MB / ${procMem.heapUsedMb || 0} MB</span>
            </div>
            <div class="flex justify-between">
              <span>SQLite DB (${db.dbSizeMb || 0} MB + WAL ${db.walSizeMb || 0} MB):</span>
              <span class="text-zinc-200">${dbRecords.jobs || 0} jobs · ${dbRecords.fileRecords || 0} files · ${dbRecords.history || 0} history</span>
            </div>
            <div class="flex justify-between">
              <span>Redis Cache (${redis.status || 'offline'}):</span>
              <span class="text-zinc-200">${redis.usedMemory || 'N/A'} · ${redis.keyCount || 0} keys</span>
            </div>
            <div class="flex justify-between">
              <span>Storage Breakdown:</span>
              <span class="text-zinc-200">
                up: ${storageBreakdown.uploads?.sizeMb || 0}M · proc: ${storageBreakdown.processed?.sizeMb || 0}M · temp: ${storageBreakdown.temp?.sizeMb || 0}M · drive: ${storageBreakdown.drive?.sizeMb || 0}M
              </span>
            </div>
          </div>
        </div>

        <!-- Panel 3: BullMQ Workers & Processing Engines -->
        <div class="p-6 rounded-3xl bg-zinc-900/60 border border-white/5 backdrop-blur-xl shadow-xl space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <i data-lucide="layers" class="w-4 h-4 text-cyan-400"></i>
              Hàng Đợi BullMQ & Engines Xử Lý
            </h3>
            <span class="text-xs font-mono text-zinc-400">
              Đang chạy: <strong class="text-emerald-400">${queues.totalActive || 0}</strong> · Chờ: <strong class="text-amber-400">${queues.totalWaiting || 0}</strong>
            </span>
          </div>

          <!-- Queues Matrix -->
          <div class="space-y-2 text-xs font-mono">
            <!-- PDF Queue -->
            <div class="p-3 rounded-xl bg-zinc-950/50 border border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-2 font-sans font-medium text-zinc-200">
                <span class="w-2 h-2 rounded-full bg-red-400"></span>
                <span>PDF Studio Worker</span>
              </div>
              <div class="flex items-center gap-3 text-zinc-400">
                <span>Active: <strong class="text-emerald-400">${queues.pdf?.active || 0}</strong></span>
                <span>Wait: <strong class="text-amber-400">${queues.pdf?.waiting || 0}</strong></span>
                <span>Done: <strong class="text-zinc-200">${queues.pdf?.completed || 0}</strong></span>
                <span>Fail: <strong class="text-rose-400">${queues.pdf?.failed || 0}</strong></span>
              </div>
            </div>

            <!-- Converter Queue -->
            <div class="p-3 rounded-xl bg-zinc-950/50 border border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-2 font-sans font-medium text-zinc-200">
                <span class="w-2 h-2 rounded-full bg-indigo-400"></span>
                <span>Universal Converter Worker</span>
              </div>
              <div class="flex items-center gap-3 text-zinc-400">
                <span>Active: <strong class="text-emerald-400">${queues.converter?.active || 0}</strong></span>
                <span>Wait: <strong class="text-amber-400">${queues.converter?.waiting || 0}</strong></span>
                <span>Done: <strong class="text-zinc-200">${queues.converter?.completed || 0}</strong></span>
                <span>Fail: <strong class="text-rose-400">${queues.converter?.failed || 0}</strong></span>
              </div>
            </div>

            <!-- Quiz Queue -->
            <div class="p-3 rounded-xl bg-zinc-950/50 border border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-2 font-sans font-medium text-zinc-200">
                <span class="w-2 h-2 rounded-full bg-orange-400"></span>
                <span>Quiz Generator Worker</span>
              </div>
              <div class="flex items-center gap-3 text-zinc-400">
                <span>Active: <strong class="text-emerald-400">${queues.quiz?.active || 0}</strong></span>
                <span>Wait: <strong class="text-amber-400">${queues.quiz?.waiting || 0}</strong></span>
                <span>Done: <strong class="text-zinc-200">${queues.quiz?.completed || 0}</strong></span>
                <span>Fail: <strong class="text-rose-400">${queues.quiz?.failed || 0}</strong></span>
              </div>
            </div>
          </div>

          <!-- Engine Readiness Badges -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5 text-center text-xs">
            <div class="p-2 rounded-lg bg-zinc-950/50 border border-white/5">
              <div class="text-[11px] text-zinc-400">PyMuPDF</div>
              <div class="text-emerald-400 font-bold text-[10px]">READY</div>
            </div>
            <div class="p-2 rounded-lg bg-zinc-950/50 border border-white/5">
              <div class="text-[11px] text-zinc-400">FFmpeg 7.0</div>
              <div class="text-emerald-400 font-bold text-[10px]">READY</div>
            </div>
            <div class="p-2 rounded-lg bg-zinc-950/50 border border-white/5">
              <div class="text-[11px] text-zinc-400">LibreOffice</div>
              <div class="text-emerald-400 font-bold text-[10px]">READY</div>
            </div>
            <div class="p-2 rounded-lg bg-zinc-950/50 border border-white/5">
              <div class="text-[11px] text-zinc-400">Chrome CDP</div>
              <div class="text-emerald-400 font-bold text-[10px]">READY</div>
            </div>
          </div>
        </div>

        <!-- Panel 4: Cloudflare & Infrastructure -->
        <div class="p-6 rounded-3xl bg-zinc-900/60 border border-white/5 backdrop-blur-xl shadow-xl space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <i data-lucide="cloud" class="w-4 h-4 text-orange-400"></i>
              Đám Mây & Cloudflare Hạ Tầng
            </h3>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
              studio.duydev.cloud
            </span>
          </div>

          <!-- Cloudflare R2 Monthly Budget -->
          <div class="p-4 rounded-xl bg-zinc-950/50 border border-white/5 space-y-3">
            <div class="flex items-center justify-between text-xs">
              <span class="text-zinc-300 font-medium">Hạn ngạch R2 Class A (Tháng)</span>
              <span class="font-mono text-zinc-200 font-bold">
                ${(r2.currentRequests || 0).toLocaleString()} / ${(r2.monthlyLimit || 900000).toLocaleString()}
              </span>
            </div>
            <div class="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div class="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500" style="width: ${r2.percentUsed || 0}%"></div>
            </div>
            <div class="flex justify-between text-[11px] text-zinc-400">
              <span>Đã dùng: ${r2.percentUsed || 0}% ngân sách miễn phí</span>
              <span>Bucket: ${r2.bucket || 'ddstudio-backend'}</span>
            </div>
          </div>

          <!-- Cloudflare Tunnel Status -->
          <div class="p-4 rounded-xl bg-zinc-950/50 border border-white/5 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2.5">
              <div class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
              <div>
                <div class="font-medium text-zinc-200">Cloudflare Tunnel (HTTP/2 Multiplexing)</div>
                <div class="text-zinc-400 text-[11px] mt-0.5">Vượt bóp băng thông UDP QUIC của nhà mạng ISP</div>
              </div>
            </div>
            <span class="font-mono text-emerald-400 font-bold">ACTIVE</span>
          </div>
        </div>
      </div>

      <!-- 4. Panel 5: AI Agents, API Keys & Rate Limit Quota Card -->
      <div id="adminAiAgentsContainer">
        ${renderAiAgentsCard(d.ai)}
      </div>

      <!-- 5. Admin Quick Actions Dock -->
      <div class="p-6 rounded-3xl bg-zinc-900/60 border border-white/5 backdrop-blur-xl shadow-xl space-y-4">
        <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <i data-lucide="wrench" class="w-4 h-4 text-orange-400"></i>
          Thao Tác Quản Trị Nhanh (Quick Actions)
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            id="btnAdminCleanTemp"
            class="p-3.5 rounded-xl bg-zinc-950/60 hover:bg-zinc-800/80 border border-white/5 text-left text-zinc-200 transition-all hover:border-orange-500/30 group cursor-pointer"
          >
            <div class="text-xs font-semibold group-hover:text-orange-400 flex items-center justify-between">
              <span>Dọn Rác Tệp Tạm Đĩa</span>
              <i data-lucide="trash-2" class="w-3.5 h-3.5 text-zinc-500 group-hover:text-orange-400"></i>
            </div>
            <div class="text-[11px] text-zinc-500 mt-1">Xóa sạch tệp tạm trong data/storage/temp</div>
          </button>

          <button
            id="btnAdminCleanR2"
            class="p-3.5 rounded-xl bg-zinc-950/60 hover:bg-zinc-800/80 border border-white/5 text-left text-zinc-200 transition-all hover:border-orange-500/30 group cursor-pointer"
          >
            <div class="text-xs font-semibold group-hover:text-orange-400 flex items-center justify-between">
              <span>Dọn Rác R2 Transit</span>
              <i data-lucide="cloud-off" class="w-3.5 h-3.5 text-zinc-500 group-hover:text-orange-400"></i>
            </div>
            <div class="text-[11px] text-zinc-500 mt-1">Quét và xóa tệp mồ côi trên Cloudflare R2</div>
          </button>

          <button
            id="btnAdminCleanQueues"
            class="p-3.5 rounded-xl bg-zinc-950/60 hover:bg-zinc-800/80 border border-white/5 text-left text-zinc-200 transition-all hover:border-orange-500/30 group cursor-pointer"
          >
            <div class="text-xs font-semibold group-hover:text-orange-400 flex items-center justify-between">
              <span>Dọn Dẹp Job Redis Cũ</span>
              <i data-lucide="check-check" class="w-3.5 h-3.5 text-zinc-500 group-hover:text-orange-400"></i>
            </div>
            <div class="text-[11px] text-zinc-500 mt-1">Xóa các job Completed & Failed trong Redis</div>
          </button>

          <button
            id="btnAdminWipeStates"
            class="p-3.5 rounded-xl bg-zinc-950/60 hover:bg-zinc-800/80 border border-white/5 text-left text-zinc-200 transition-all hover:border-rose-500/30 group cursor-pointer"
          >
            <div class="text-xs font-semibold group-hover:text-rose-400 flex items-center justify-between">
              <span>Xóa Bộ Nhớ Module</span>
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5 text-zinc-500 group-hover:text-rose-400"></i>
            </div>
            <div class="text-[11px] text-zinc-500 mt-1">Reset toàn bộ module states lưu cục bộ</div>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Attaches event listeners for the Admin Page
 */
export function attachAdminPageListeners(onRerender) {
  const isAuth = isAdminAuthenticated();

  // 1. Locked State Handlers
  if (!isAuth) {
    const inputPwd = document.getElementById('adminPagePwdInput');
    const btnUnlock = document.getElementById('btnAdminPageUnlock');
    const errorText = document.getElementById('adminPageErrorText');

    const handleUnlock = async () => {
      if (!inputPwd) return;
      const pwd = inputPwd.value.trim();
      if (!pwd) return;

      const isValid = await verifyAdminPassword(pwd);
      if (isValid) {
        showToast('Đã mở khóa Quản trị viên thành công', 'success');
        if (onRerender) onRerender();
      } else {
        if (errorText) errorText.classList.remove('hidden');
        inputPwd.classList.add('border-rose-500');
        inputPwd.focus();
        inputPwd.select();
      }
    };

    if (btnUnlock) btnUnlock.onclick = handleUnlock;
    if (inputPwd) {
      inputPwd.onkeydown = (e) => {
        if (e.key === 'Enter') handleUnlock();
      };
      inputPwd.focus();
    }
    return;
  }

  // 2. Unlocked State Handlers
  // Top bar controls
  const btnLock = document.getElementById('btnAdminLockSession');
  if (btnLock) {
    btnLock.onclick = () => {
      stopAdminPolling();
      lockAdminSession();
      showToast('Đã khóa phiên Quản trị', 'info');
      if (onRerender) onRerender();
    };
  }

  const btnChangePwd = document.getElementById('btnAdminChangePwd');
  if (btnChangePwd) {
    btnChangePwd.onclick = () => {
      showChangePasswordModal(() => {
        if (onRerender) onRerender();
      });
    };
  }

  const btnRefresh = document.getElementById('btnManualRefreshAdmin');
  if (btnRefresh) {
    btnRefresh.onclick = () => {
      fetchAdminTelemetry(onRerender);
      showToast('Đã làm mới thông số telemetry', 'info');
    };
  }

  const btnToggleTicker = document.getElementById('btnToggleAdminTicker');
  if (btnToggleTicker) {
    btnToggleTicker.onclick = () => {
      isPollingPaused = !isPollingPaused;
      const textEl = document.getElementById('adminTickerText');
      if (textEl) {
        textEl.textContent = isPollingPaused ? 'Tiếp tục 3s' : 'Đang trực tiếp 3s';
      }
      showToast(isPollingPaused ? 'Đã tạm dừng tự động làm mới' : 'Đã bật trực tiếp 3s', 'info');
    };
  }

  // Quick Action Buttons
  const btnCleanTemp = document.getElementById('btnAdminCleanTemp');
  if (btnCleanTemp) {
    btnCleanTemp.onclick = async () => {
      try {
        const resp = await fetch('/api/v1/admin/actions/clean-temp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() }
        });
        const json = await resp.json();
        showToast(json.message || 'Đã dọn dẹp tệp tạm', json.success ? 'success' : 'error');
        fetchAdminTelemetry(onRerender);
      } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
      }
    };
  }

  const btnCleanR2 = document.getElementById('btnAdminCleanR2');
  if (btnCleanR2) {
    btnCleanR2.onclick = async () => {
      try {
        const resp = await fetch('/api/v1/admin/actions/clean-r2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() }
        });
        const json = await resp.json();
        showToast(json.message || 'Đã dọn dẹp R2 transit', json.success ? 'success' : 'error');
        fetchAdminTelemetry(onRerender);
      } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
      }
    };
  }

  const btnCleanQueues = document.getElementById('btnAdminCleanQueues');
  if (btnCleanQueues) {
    btnCleanQueues.onclick = async () => {
      try {
        const resp = await fetch('/api/v1/admin/actions/clean-queues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() }
        });
        const json = await resp.json();
        showToast(json.message || 'Đã dọn dẹp hàng đợi', json.success ? 'success' : 'error');
        fetchAdminTelemetry(onRerender);
      } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
      }
    };
  }

  const btnWipeStates = document.getElementById('btnAdminWipeStates');
  if (btnWipeStates) {
    btnWipeStates.onclick = () => {
      clearAllModuleStates();
      showToast('Đã xóa toàn bộ bộ nhớ module cục bộ', 'info');
      setTimeout(() => window.location.reload(), 300);
    };
  }

  // Attach AI Agents Card listeners
  const aiContainer = document.getElementById('adminAiAgentsContainer');
  if (aiContainer) {
    attachAiAgentsListeners(aiContainer, () => fetchAdminTelemetry(onRerender));
  }

  // Draw Initial Canvas Sparkline
  updateCanvasSparkline();

  // Initial Fetch & Start Polling
  fetchAdminTelemetry(onRerender);
  startAdminPolling(onRerender);
}

/**
 * Updates the 60s Traffic Sparkline Canvas
 */
function updateCanvasSparkline() {
  const canvas = document.getElementById('adminTrafficSparkline');
  if (!canvas) return;

  const points = trafficHistoryRps.length > 0 ? trafficHistoryRps : [0, 0];
  drawSparklineCanvas(canvas, points, {
    strokeColor: '#f97316',
    fillColorTop: 'rgba(249, 115, 22, 0.25)',
    fillColorBottom: 'rgba(249, 115, 22, 0.0)'
  });
}

/**
 * Fetches latest telemetry data from Fastify API
 */
async function fetchAdminTelemetry(onRerender) {
  if (!isAdminAuthenticated()) return;

  try {
    const resp = await fetch('/api/v1/admin/telemetry', {
      headers: getStorageAuthHeaders()
    });

    if (resp.status === 401) {
      lockAdminSession();
      if (onRerender) onRerender();
      return;
    }

    const json = await resp.json();
    if (json.success && json.data) {
      latestTelemetryData = json.data;

      // Extract rolling RPS timeline
      const timeline = json.data.traffic?.timeline || [];
      if (timeline.length > 0) {
        trafficHistoryRps = timeline.map(t => t.rps);
      } else {
        const liveRps = json.data.traffic?.summary?.liveRps || 0;
        trafficHistoryRps.push(liveRps);
        if (trafficHistoryRps.length > 60) trafficHistoryRps.shift();
      }

      // Update sparkline canvas directly without full DOM tear-down
      updateCanvasSparkline();

      // Refresh icons if lucide is present
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  } catch (err) {
    console.warn('[AdminPage] Failed to fetch telemetry snapshot:', err);
  }
}

/**
 * Starts 3s adaptive polling with battery-conscious background suspension
 */
function startAdminPolling(onRerender) {
  stopAdminPolling();

  telemetryPollingTimer = setInterval(() => {
    // Battery optimization: pause polling if tab is in background or manually paused
    if (document.hidden || isPollingPaused) {
      return;
    }
    fetchAdminTelemetry(onRerender);
  }, 3000);

  // Resume immediately on tab focus
  const handleVisibility = () => {
    if (!document.hidden && !isPollingPaused) {
      fetchAdminTelemetry(onRerender);
    }
  };

  document.removeEventListener('visibilitychange', handleVisibility);
  document.addEventListener('visibilitychange', handleVisibility);
}

/**
 * Stops polling timer
 */
export function stopAdminPolling() {
  if (telemetryPollingTimer) {
    clearInterval(telemetryPollingTimer);
    telemetryPollingTimer = null;
  }
}
