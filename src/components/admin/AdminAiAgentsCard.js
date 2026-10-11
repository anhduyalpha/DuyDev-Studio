/**
 * AdminAiAgentsCard.js - AI Agents, Keys, Rate Limit Quota & Invocation Telemetry
 * Real-time monitoring of Agnes AI and fallback providers with multi-key management and call logs inspector
 */

import { getStorageAuthHeaders } from '../../utilities/adminAuth.js';
import { showToast } from '../../utilities/toast.js';

let cachedAiData = null;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderAiAgentsCard(aiData) {
  cachedAiData = aiData;
  if (!aiData) {
    return `
      <div class="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 text-center text-zinc-500">
        Đang tải dữ liệu AI Agents...
      </div>
    `;
  }

  const { keys = [], rateLimits = {}, cumulative = {}, recentLogs = [] } = aiData;
  const rpmPct = rateLimits.rpmPercent || 0;
  const tpmPct = rateLimits.tpmPercent || 0;
  const dailyPct = rateLimits.dailyPercent || 0;

  const rpmColor = rpmPct > 80 ? 'bg-rose-500' : rpmPct > 50 ? 'bg-amber-500' : 'bg-emerald-500';
  const tpmColor = tpmPct > 80 ? 'bg-rose-500' : tpmPct > 50 ? 'bg-amber-500' : 'bg-orange-500';
  const dailyColor = dailyPct > 85 ? 'bg-rose-500' : dailyPct > 60 ? 'bg-amber-500' : 'bg-cyan-500';

  // Sort keys by priority
  const sortedKeys = [...keys].sort((a, b) => (a.priority || 1) - (b.priority || 1));

  return `
    <div class="rounded-2xl bg-zinc-900/60 border border-white/5 backdrop-blur-md overflow-hidden shadow-xl">
      <!-- Card Header -->
      <div class="px-6 py-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-4 bg-zinc-950/40">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <i data-lucide="bot" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-zinc-100 flex items-center gap-2">
              AI Agents & Token Rate Limits
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                Multi-Key Fallback Pipeline
              </span>
            </h3>
            <p class="text-xs text-zinc-400">Hệ thống gọi tuần tự theo độ ưu tiên, tự động fallback khi gặp lỗi và ghi vết chi tiết</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            id="btnOpenAddAiKeyModal"
            class="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Thêm API Key dự phòng"
          >
            <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
            + Thêm Key Dự Phòng
          </button>
          <button
            type="button"
            id="btnRefreshAiMetrics"
            class="px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 text-xs font-medium border border-white/5 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Làm mới thông số AI"
          >
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            Làm mới
          </button>
        </div>
      </div>

      <!-- Content Grid -->
      <div class="p-6 space-y-6">
        <!-- 1. Live Rate Limit Gauges / Bars -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- RPM Bar -->
          <div class="p-4 rounded-xl bg-zinc-950/50 border border-white/5">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-zinc-400">Tốc độ Yêu cầu (RPM)</span>
              <span class="text-xs font-mono font-bold text-zinc-200">
                ${rateLimits.liveRpm || 0} / ${rateLimits.rpmLimit || 60} <span class="text-[10px] text-zinc-500">req/m</span>
              </span>
            </div>
            <div class="w-full h-2 rounded-full bg-zinc-800 overflow-hidden mb-1.5">
              <div class="h-full rounded-full transition-all duration-500 ${rpmColor}" style="width: ${rpmPct}%"></div>
            </div>
            <div class="flex justify-between text-[10px] text-zinc-500">
              <span>Đang dùng: ${rpmPct}%</span>
              <span>Cửa sổ 60 giây</span>
            </div>
          </div>

          <!-- TPM Bar -->
          <div class="p-4 rounded-xl bg-zinc-950/50 border border-white/5">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-zinc-400">Lưu lượng Token (TPM)</span>
              <span class="text-xs font-mono font-bold text-zinc-200">
                ${(rateLimits.liveTpm || 0).toLocaleString()} / ${(rateLimits.tpmLimit || 100000).toLocaleString()}
              </span>
            </div>
            <div class="w-full h-2 rounded-full bg-zinc-800 overflow-hidden mb-1.5">
              <div class="h-full rounded-full transition-all duration-500 ${tpmColor}" style="width: ${tpmPct}%"></div>
            </div>
            <div class="flex justify-between text-[10px] text-zinc-500">
              <span>Đang dùng: ${tpmPct}%</span>
              <span>Tokens / phút</span>
            </div>
          </div>

          <!-- Daily Limit Bar -->
          <div class="p-4 rounded-xl bg-zinc-950/50 border border-white/5">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-zinc-400">Hạn ngạch Hôm nay</span>
              <span class="text-xs font-mono font-bold text-zinc-200">
                ${rateLimits.dailyCalls || 0} / ${rateLimits.dailyLimit || 1500} <span class="text-[10px] text-zinc-500">calls</span>
              </span>
            </div>
            <div class="w-full h-2 rounded-full bg-zinc-800 overflow-hidden mb-1.5">
              <div class="h-full rounded-full transition-all duration-500 ${dailyColor}" style="width: ${dailyPct}%"></div>
            </div>
            <div class="flex justify-between text-[10px] text-zinc-500">
              <span>Hôm nay: ${((rateLimits.dailyTokens || 0) / 1000).toFixed(1)}k tokens</span>
              <span>${dailyPct}% hạn ngạch</span>
            </div>
          </div>
        </div>

        <!-- 2. AI Keys Registry -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <i data-lucide="key" class="w-3.5 h-3.5 text-orange-400"></i>
              Danh Sách API Keys Dự Phòng & Thứ Tự Ưu Tiên (${sortedKeys.length})
            </h4>
            <span class="text-[11px] text-zinc-500 font-mono">Gọi tuần tự: P1 ➔ P2 ➔ P3</span>
          </div>

          <div class="space-y-3">
            ${sortedKeys.map(key => {
              const pingStatus = key.lastPingStatus;
              let pingBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-400">Chưa kiểm tra</span>`;
              if (pingStatus === 'ok') {
                pingBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active (${key.lastPingMs}ms)</span>`;
              } else if (pingStatus === 'rate_limited') {
                pingBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Rate Limited (429)</span>`;
              } else if (pingStatus === 'error') {
                pingBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">Lỗi kết nối</span>`;
              }

              const isPrimary = key.id === 'agnes-primary';
              const priorityText = isPrimary ? `P${key.priority || 1} (Primary)` : `P${key.priority || 2} (Fallback)`;
              const priorityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${isPrimary ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'}">${priorityText}</span>`;

              const providerLabel = String(key.provider || 'custom').toUpperCase();

              return `
                <div class="p-4 rounded-xl bg-zinc-950/60 border border-white/5 flex flex-wrap items-center justify-between gap-4 hover:border-white/10 transition">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 text-xs font-bold font-mono">
                      ${providerLabel.slice(0, 3)}
                    </div>
                    <div>
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-semibold text-zinc-100">${escapeHtml(key.name)}</span>
                        ${priorityBadge}
                        ${pingBadge}
                        ${!key.isActive ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-500">Đã tắt</span>' : ''}
                      </div>
                      <div class="text-xs text-zinc-500 font-mono mt-0.5 flex flex-wrap items-center gap-3">
                        <span>Model: <span class="text-zinc-300">${escapeHtml(key.model || 'agnes-3.0-flash')}</span></span>
                        <span>Key: <span class="text-zinc-300 font-mono">${escapeHtml(key.apiKeyMasked || 'Chưa cấu hình')}</span></span>
                        <span class="truncate max-w-[200px]" title="${escapeHtml(key.baseUrl)}">${escapeHtml(key.baseUrl)}</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="btn-test-ai-key px-3 py-1.5 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
                      data-key-id="${escapeHtml(key.id)}"
                      title="Kiểm tra kết nối tới key này"
                    >
                      <i data-lucide="activity" class="w-3.5 h-3.5 text-emerald-400"></i>
                      Test Ping
                    </button>
                    <button
                      type="button"
                      class="btn-edit-ai-key px-3 py-1.5 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 text-xs font-medium border border-orange-500/30 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
                      data-key-id="${escapeHtml(key.id)}"
                      data-key-name="${escapeHtml(key.name)}"
                      data-key-provider="${escapeHtml(key.provider || 'custom')}"
                      data-key-model="${escapeHtml(key.model || '')}"
                      data-key-baseurl="${escapeHtml(key.baseUrl || '')}"
                      data-key-priority="${key.priority || 1}"
                      data-key-active="${key.isActive !== false ? 'true' : 'false'}"
                      title="Sửa cấu hình key"
                    >
                      <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                      Sửa Key
                    </button>
                    ${!isPrimary ? `
                      <button
                        type="button"
                        class="btn-delete-ai-key px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/20 transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                        data-key-id="${escapeHtml(key.id)}"
                        data-key-name="${escapeHtml(key.name)}"
                        title="Xóa key dự phòng này"
                      >
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 3. Recent Invocation Logs Table -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <i data-lucide="scroll-text" class="w-3.5 h-3.5 text-orange-400"></i>
              Nhật Ký Cuộc Gọi AI Gần Nhất (Click xem chi tiết lỗi)
            </h4>
            <span class="text-[11px] font-mono text-zinc-500">
              Tổng cộng: ${cumulative.totalCalls || 0} calls | ${((cumulative.totalTokens || 0) / 1000).toFixed(1)}k tokens
            </span>
          </div>

          <div class="overflow-x-auto rounded-xl border border-white/5 bg-zinc-950/40">
            <table class="w-full text-left text-xs">
              <thead class="bg-zinc-900/60 text-zinc-400 font-mono text-[11px] border-b border-white/5">
                <tr>
                  <th class="px-3.5 py-2.5">Thời gian</th>
                  <th class="px-3.5 py-2.5">Module</th>
                  <th class="px-3.5 py-2.5">Key Sử Dụng</th>
                  <th class="px-3.5 py-2.5">Model</th>
                  <th class="px-3.5 py-2.5 text-right">Tokens</th>
                  <th class="px-3.5 py-2.5 text-right">Độ trễ</th>
                  <th class="px-3.5 py-2.5 text-center">Trạng thái</th>
                  <th class="px-3.5 py-2.5 text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5 text-zinc-300 font-mono">
                ${recentLogs && recentLogs.length > 0 ? recentLogs.map((log, index) => {
                  const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '--:--:--';
                  let statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">200 OK</span>`;
                  if (log.isFallbackRecovered || log.status === 'FALLBACK_RECOVERED') {
                    statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 justify-center" title="Lỗi khóa chính nhưng đã tự động cứu thành công qua khóa dự phòng (${escapeHtml(log.recoveredByKey || '')})"><i data-lucide="check-check" class="w-3 h-3 text-emerald-400"></i> FALLBACK_RECOVERED</span>`;
                  } else if (log.statusCode === 429) {
                    statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">429 LIMIT</span>`;
                  } else if (log.statusCode === 504) {
                    statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">504 TIMEOUT</span>`;
                  } else if (log.statusCode >= 400) {
                    statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">${log.statusCode} ERR</span>`;
                  }

                  const keyLabel = log.keyName || (log.keyId ? `#${log.keyId}` : log.provider || 'Agnes Primary');

                  return `
                    <tr class="hover:bg-white/[0.04] transition-colors cursor-pointer row-ai-call-log" data-log-index="${index}">
                      <td class="px-3.5 py-2 text-zinc-400">${timeStr}</td>
                      <td class="px-3.5 py-2 text-zinc-200 font-sans font-medium">${escapeHtml(log.module)}</td>
                      <td class="px-3.5 py-2 text-zinc-300 font-sans text-[11px] truncate max-w-[140px]" title="${escapeHtml(keyLabel)}">
                        <span class="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px]">${escapeHtml(keyLabel)}</span>
                      </td>
                      <td class="px-3.5 py-2 text-zinc-400">${escapeHtml(log.model)}</td>
                      <td class="px-3.5 py-2 text-right font-bold text-orange-400">${log.totalTokens}</td>
                      <td class="px-3.5 py-2 text-right text-zinc-400">${log.latencyMs}ms</td>
                      <td class="px-3.5 py-2 text-center">${statusBadge}</td>
                      <td class="px-3.5 py-2 text-center">
                        <button type="button" class="text-zinc-500 hover:text-orange-400 p-1" title="Xem chi tiết cuộc gọi">
                          <i data-lucide="info" class="w-3.5 h-3.5"></i>
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="8" class="px-4 py-8 text-center text-zinc-500 font-sans">
                      Chưa có nhật ký cuộc gọi AI nào được ghi nhận.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Opens a modal to add or edit an AI key
 */
function openAiKeyModal({ key = null, onSaved = null }) {
  const isEdit = Boolean(key && key.id);
  const existing = key || {
    id: `ai-key-${Date.now().toString(36)}`,
    name: '',
    provider: 'agnes',
    baseUrl: 'https://apihub.agnes-ai.com/v1',
    model: 'agnes-3.0-flash',
    apiKey: '',
    priority: 2,
    isActive: true
  };

  const modalId = 'modalAiKeyForm';
  const oldModal = document.getElementById(modalId);
  if (oldModal) oldModal.remove();

  const providerDefaults = {
    agnes: { baseUrl: 'https://apihub.agnes-ai.com/v1', model: 'agnes-3.0-flash' },
    gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-1.5-flash' },
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    custom: { baseUrl: 'https://api.example.com/v1', model: 'custom-model' }
  };

  const modalHtml = `
    <div id="${modalId}" class="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div class="relative w-full max-w-lg rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121215] p-6 shadow-2xl space-y-5">
        <!-- Header -->
        <div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
              <i data-lucide="key" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                ${isEdit ? 'Chỉnh Sửa Cấu Hình API Key' : 'Thêm API Key Dự Phòng Mới'}
              </h3>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Thiết lập khóa API và thứ tự ưu tiên trong chuỗi Fallback</p>
            </div>
          </div>
          <button type="button" id="btnCloseAiKeyModal" class="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg cursor-pointer">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Form -->
        <form id="formAiKey" class="space-y-3.5 text-xs">
          <input type="hidden" id="inputKeyId" value="${escapeHtml(existing.id)}" />

          <!-- Name -->
          <div>
            <label class="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Tên Gọi Khóa (Name)</label>
            <input
              type="text"
              id="inputKeyName"
              required
              placeholder="VD: Agnes Flash Dự Phòng 2, Gemini 1.5 Flash..."
              value="${escapeHtml(existing.name)}"
              class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
            />
          </div>

          <!-- Provider & Priority Grid -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Nhà Cung Cấp (Provider)</label>
              <select
                id="selectKeyProvider"
                class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="agnes" ${existing.provider === 'agnes' ? 'selected' : ''}>Agnes AI</option>
                <option value="gemini" ${existing.provider === 'gemini' ? 'selected' : ''}>Google Gemini</option>
                <option value="openai" ${existing.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                <option value="custom" ${existing.provider === 'custom' ? 'selected' : ''}>Tùy chỉnh (Custom)</option>
              </select>
            </div>
            <div>
              <label class="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Độ Ưu Tiên (Priority)</label>
              <input
                type="number"
                id="inputKeyPriority"
                min="1"
                max="99"
                value="${existing.priority || 2}"
                class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500 font-mono"
              />
              <span class="text-[10px] text-zinc-500 mt-0.5 block">1 = Cao nhất (gọi trước)</span>
            </div>
          </div>

          <!-- Base URL -->
          <div>
            <label class="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Điểm Cuối API (Base URL)</label>
            <input
              type="text"
              id="inputKeyBaseUrl"
              required
              value="${escapeHtml(existing.baseUrl)}"
              placeholder="https://apihub.agnes-ai.com/v1"
              class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500 font-mono"
            />
          </div>

          <!-- Model -->
          <div>
            <label class="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Tên Model (Model Identifier)</label>
            <input
              type="text"
              id="inputKeyModel"
              required
              value="${escapeHtml(existing.model)}"
              placeholder="agnes-3.0-flash"
              class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500 font-mono"
            />
          </div>

          <!-- API Key -->
          <div>
            <label class="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Khóa Bí Mật (API Key) ${isEdit ? '<span class="text-zinc-500 font-normal">(để trống nếu giữ nguyên)</span>' : ''}
            </label>
            <div class="relative">
              <input
                type="password"
                id="inputKeySecret"
                ${isEdit ? '' : 'required'}
                placeholder="${isEdit ? 'Nhập khóa mới nếu muốn đổi...' : 'sk-...'}"
                class="w-full px-3 py-2 pr-10 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500 font-mono"
              />
              <button
                type="button"
                id="btnToggleAiKeyVisibility"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-0.5"
                title="Hiện/Ẩn API key"
              >
                <i data-lucide="eye" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>

          <!-- Active Checkbox -->
          <div class="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="inputKeyActive"
              ${existing.isActive !== false ? 'checked' : ''}
              class="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 cursor-pointer"
            />
            <label for="inputKeyActive" class="text-xs text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer">
              Kích hoạt key này cho chuỗi Fallback tự động
            </label>
          </div>

          <!-- Submit Buttons -->
          <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-white/5">
            <button
              type="button"
              id="btnCancelAiKeyModal"
              class="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              id="btnSubmitAiKeyModal"
              class="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <i data-lucide="save" class="w-3.5 h-3.5"></i>
              <span>Lưu Cấu Hình Key</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  if (window.lucide) window.lucide.createIcons();

  const modalEl = document.getElementById(modalId);
  const close = () => { if (modalEl) modalEl.remove(); };

  modalEl.querySelector('#btnCloseAiKeyModal').onclick = close;
  modalEl.querySelector('#btnCancelAiKeyModal').onclick = close;

  // Toggle secret visibility
  const btnToggle = modalEl.querySelector('#btnToggleAiKeyVisibility');
  const secretInput = modalEl.querySelector('#inputKeySecret');
  btnToggle.onclick = () => {
    const isPwd = secretInput.type === 'password';
    secretInput.type = isPwd ? 'text' : 'password';
  };

  // Provider auto-fill change
  const selectProv = modalEl.querySelector('#selectKeyProvider');
  selectProv.onchange = () => {
    const prov = selectProv.value;
    const defaults = providerDefaults[prov];
    if (defaults) {
      modalEl.querySelector('#inputKeyBaseUrl').value = defaults.baseUrl;
      modalEl.querySelector('#inputKeyModel').value = defaults.model;
    }
  };

  // Submit
  const form = modalEl.querySelector('#formAiKey');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btnSubmit = modalEl.querySelector('#btnSubmitAiKeyModal');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="inline-block animate-spin mr-1">⟳</span> Đang lưu...';

    const payload = {
      id: modalEl.querySelector('#inputKeyId').value.trim(),
      name: modalEl.querySelector('#inputKeyName').value.trim(),
      provider: modalEl.querySelector('#selectKeyProvider').value,
      baseUrl: modalEl.querySelector('#inputKeyBaseUrl').value.trim(),
      model: modalEl.querySelector('#inputKeyModel').value.trim(),
      priority: parseInt(modalEl.querySelector('#inputKeyPriority').value, 10) || 1,
      isActive: modalEl.querySelector('#inputKeyActive').checked
    };

    const secret = modalEl.querySelector('#inputKeySecret').value.trim();
    if (secret) {
      payload.apiKey = secret;
    }

    try {
      const resp = await fetch('/api/v1/admin/ai/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getStorageAuthHeaders()
        },
        body: JSON.stringify(payload)
      });
      const json = await resp.json();
      if (json.success) {
        showToast(json.message || 'Đã lưu cấu hình API key', 'success');
        close();
        if (onSaved) onSaved();
      } else {
        showToast(`Lỗi: ${json.message}`, 'error');
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5"></i> <span>Lưu Cấu Hình Key</span>';
      }
    } catch (err) {
      showToast(`Không thể kết nối máy chủ: ${err.message}`, 'error');
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5"></i> <span>Lưu Cấu Hình Key</span>';
    }
  };
}

/**
 * Opens detailed modal for an AI invocation log
 */
function openAiCallDetailModal(log) {
  if (!log) return;
  const modalId = 'modalAiCallDetail';
  const oldModal = document.getElementById(modalId);
  if (oldModal) oldModal.remove();

  const isRecovered = Boolean(log.isFallbackRecovered || log.status === 'FALLBACK_RECOVERED');
  const isErr = log.statusCode >= 400 && !isRecovered;
  const statusColor = isRecovered
    ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
    : log.statusCode === 200
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : log.statusCode === 429
    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-rose-400 bg-rose-500/15 border-rose-500/30';

  const modalHtml = `
    <div id="${modalId}" class="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div class="relative w-full max-w-lg rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121215] p-6 shadow-2xl space-y-4">
        <!-- Header -->
        <div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl ${isRecovered ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : isErr ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'} flex items-center justify-center">
              <i data-lucide="${isRecovered ? 'check-check' : isErr ? 'alert-triangle' : 'check-circle'}" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Chi Tiết Cuộc Gọi AI (${escapeHtml(log.module)})
              </h3>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">${new Date(log.timestamp).toLocaleString()}</p>
            </div>
          </div>
          <button type="button" id="btnCloseAiCallDetail" class="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg cursor-pointer">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Metrics Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
          <div class="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5">
            <span class="text-[10px] text-zinc-500 block">Mã phản hồi</span>
            <span class="font-bold px-1.5 py-0.5 rounded text-[11px] inline-block mt-0.5 border ${statusColor}">
              ${isRecovered ? `FALLBACK_RECOVERED (${log.statusCode})` : log.statusCode === 200 ? '200 OK' : log.statusCode === 504 ? '504 TIMEOUT' : log.statusCode === 429 ? '429 LIMIT' : `${log.statusCode} ERROR`}
            </span>
          </div>
          <div class="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5">
            <span class="text-[10px] text-zinc-500 block">Thời gian trễ</span>
            <span class="text-sm font-bold text-zinc-200">${log.latencyMs}ms</span>
          </div>
          <div class="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5">
            <span class="text-[10px] text-zinc-500 block">Tổng Tokens</span>
            <span class="text-sm font-bold text-orange-400">${log.totalTokens}</span>
          </div>
        </div>

        <!-- Key & Model Info -->
        <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5 text-xs font-mono space-y-1">
          <div class="flex justify-between">
            <span class="text-zinc-500">Key sử dụng:</span>
            <span class="text-zinc-200 font-bold">${escapeHtml(log.keyName || log.provider || 'Primary')} ${log.keyId ? `(#${log.keyId})` : ''}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-zinc-500">Provider & Model:</span>
            <span class="text-zinc-200">${escapeHtml(log.provider)} · ${escapeHtml(log.model)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-zinc-500">Prompt / Completion:</span>
            <span class="text-zinc-200">${log.promptTokens} / ${log.completionTokens}</span>
          </div>
        </div>

        ${isRecovered ? `
          <!-- Fallback Recovered Notice -->
          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs font-sans space-y-1">
            <div class="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <i data-lucide="check-check" class="w-3.5 h-3.5 text-emerald-400"></i>
              Tự Động Phục Hồi Qua Khóa Dự Phòng (Fallback Recovered)
            </div>
            <div class="leading-relaxed">Khóa ban đầu gặp sự cố nhưng hệ thống đã tự động chuyển tiếp và hoàn tất thành công qua khóa dự phòng <b>${escapeHtml(log.recoveredByKey || 'Dự phòng')}</b> mà không làm gián đoạn tác vụ.</div>
          </div>
        ` : ''}

        ${log.errorDetails || log.errorMsg ? `
          <!-- Error Details Callout -->
          <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-mono space-y-1">
            <div class="text-[10px] font-bold uppercase tracking-wider text-rose-400">Nguyên Nhân Thất Bại (Error Details):</div>
            <div class="whitespace-pre-wrap break-all leading-relaxed">${escapeHtml(log.errorDetails || log.errorMsg)}</div>
          </div>
        ` : ''}

        ${log.promptSnippet ? `
          <!-- Prompt Snippet Preview -->
          <div class="space-y-1 text-xs">
            <span class="text-[11px] font-semibold text-zinc-400">Trích đoạn yêu cầu (Prompt Preview):</span>
            <div class="p-2.5 rounded-xl bg-zinc-900 text-zinc-300 font-mono text-[11px] leading-relaxed border border-white/5 max-h-28 overflow-y-auto select-all">
              ${escapeHtml(log.promptSnippet)}
            </div>
          </div>
        ` : ''}

        <div class="pt-2 flex justify-end">
          <button
            type="button"
            id="btnDismissAiCallDetail"
            class="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  if (window.lucide) window.lucide.createIcons();

  const modalEl = document.getElementById(modalId);
  const close = () => { if (modalEl) modalEl.remove(); };
  modalEl.querySelector('#btnCloseAiCallDetail').onclick = close;
  modalEl.querySelector('#btnDismissAiCallDetail').onclick = close;
}

/**
 * Attaches event listeners for AI test ping, key edit, key delete, and call log inspection
 */
export function attachAiAgentsListeners(containerEl, onRefresh) {
  if (!containerEl) return;

  // 1. Refresh Button
  const btnRefresh = containerEl.querySelector('#btnRefreshAiMetrics');
  if (btnRefresh && onRefresh) {
    btnRefresh.addEventListener('click', onRefresh);
  }

  // 2. Open Add Fallback Key Modal
  const btnOpenAdd = containerEl.querySelector('#btnOpenAddAiKeyModal');
  if (btnOpenAdd) {
    btnOpenAdd.onclick = () => {
      openAiKeyModal({ key: null, onSaved: onRefresh });
    };
  }

  // 3. Test Ping Buttons
  const testButtons = containerEl.querySelectorAll('.btn-test-ai-key');
  testButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const keyId = btn.dataset.keyId;
      if (!keyId) return;

      const originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="inline-block animate-spin mr-1">⟳</span> Đang ping...`;

      try {
        const resp = await fetch('/api/v1/admin/ai/test-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getStorageAuthHeaders()
          },
          body: JSON.stringify({ keyId })
        });

        const json = await resp.json();
        if (json.success) {
          showToast(`Ping thành công: ${json.data.latencyMs}ms (${json.data.message})`, 'success');
        } else {
          showToast(`Kiểm tra thất bại: ${json.data?.message || json.message}`, 'error');
        }

        if (onRefresh) onRefresh();
      } catch (err) {
        showToast(`Không thể kết nối đến máy chủ: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    });
  });

  // 4. Edit Key Buttons (Modal)
  const editButtons = containerEl.querySelectorAll('.btn-edit-ai-key');
  editButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const keyObj = {
        id: btn.dataset.keyId,
        name: btn.dataset.keyName,
        provider: btn.dataset.keyProvider || 'custom',
        model: btn.dataset.keyModel || '',
        baseUrl: btn.dataset.keyBaseurl || '',
        priority: parseInt(btn.dataset.keyPriority, 10) || 1,
        isActive: btn.dataset.keyActive !== 'false'
      };
      openAiKeyModal({ key: keyObj, onSaved: onRefresh });
    });
  });

  // 5. Delete Fallback Key Buttons
  const deleteButtons = containerEl.querySelectorAll('.btn-delete-ai-key');
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const keyId = btn.dataset.keyId;
      const keyName = btn.dataset.keyName;
      if (!keyId) return;

      const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa cấu hình API key dự phòng "${keyName}" không?`);
      if (!confirmed) return;

      try {
        const resp = await fetch(`/api/v1/admin/ai/keys/${encodeURIComponent(keyId)}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...getStorageAuthHeaders()
          }
        });
        const json = await resp.json();
        if (json.success) {
          showToast(`Đã xóa key "${keyName}" thành công`, 'success');
          if (onRefresh) onRefresh();
        } else {
          showToast(`Lỗi khi xóa key: ${json.message}`, 'error');
        }
      } catch (err) {
        showToast(`Không thể kết nối máy chủ: ${err.message}`, 'error');
      }
    });
  });

  // 6. Inspect Call Logs Rows
  const callRows = containerEl.querySelectorAll('.row-ai-call-log');
  callRows.forEach(row => {
    row.addEventListener('click', () => {
      const idx = parseInt(row.dataset.logIndex, 10);
      if (cachedAiData && cachedAiData.recentLogs && cachedAiData.recentLogs[idx]) {
        openAiCallDetailModal(cachedAiData.recentLogs[idx]);
      }
    });
  });
}
