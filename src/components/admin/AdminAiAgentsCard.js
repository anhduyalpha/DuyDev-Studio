/**
 * AdminAiAgentsCard.js - AI Agents, Keys, Rate Limit Quota & Invocation Telemetry
 * Real-time monitoring of Agnes AI and fallback providers
 */

import { getStorageAuthHeaders } from '../../utilities/adminAuth.js';
import { showToast } from '../../utilities/toast.js';

export function renderAiAgentsCard(aiData) {
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
                Agnes AI Engine
              </span>
            </h3>
            <p class="text-xs text-zinc-400">Giám sát tốc độ tiêu thụ token, hạn ngạch RPM/TPM và nhật ký cuộc gọi</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            id="btnRefreshAiMetrics"
            class="px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 text-xs font-medium border border-white/5 transition-colors flex items-center gap-1.5"
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
          <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
            <i data-lucide="key" class="w-3.5 h-3.5 text-orange-400"></i>
            Danh Sách API Keys & Điểm Cuối
          </h4>
          <div class="space-y-3">
            ${keys.map(key => {
              const pingStatus = key.lastPingStatus;
              let pingBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-400">Chưa kiểm tra</span>`;
              if (pingStatus === 'ok') {
                pingBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active (${key.lastPingMs}ms)</span>`;
              } else if (pingStatus === 'rate_limited') {
                pingBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Rate Limited (429)</span>`;
              } else if (pingStatus === 'error') {
                pingBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">Lỗi kết nối</span>`;
              }

              return `
                <div class="p-4 rounded-xl bg-zinc-950/60 border border-white/5 flex flex-wrap items-center justify-between gap-4">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 text-xs font-bold font-mono">
                      ${key.provider ? key.provider.slice(0, 2).toUpperCase() : 'AI'}
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-zinc-200">${key.name}</span>
                        ${pingBadge}
                      </div>
                      <div class="text-xs text-zinc-500 font-mono mt-0.5 flex flex-wrap items-center gap-3">
                        <span>Model: <span class="text-zinc-300">${key.model || 'agnes-3.0-flash'}</span></span>
                        <span>Key: <span class="text-zinc-300 font-mono">${key.apiKeyMasked || 'Chưa cấu hình'}</span></span>
                        <span class="truncate max-w-[200px]" title="${key.baseUrl}">${key.baseUrl}</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      class="btn-test-ai-key px-3 py-1.5 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5"
                      data-key-id="${key.id}"
                    >
                      <i data-lucide="activity" class="w-3.5 h-3.5 text-emerald-400"></i>
                      Test Ping
                    </button>
                    <button
                      class="btn-update-ai-key px-3 py-1.5 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 text-xs font-medium border border-orange-500/30 transition-colors flex items-center gap-1.5"
                      data-key-id="${key.id}"
                      data-key-name="${key.name}"
                      data-key-model="${key.model || ''}"
                      data-key-baseurl="${key.baseUrl || ''}"
                    >
                      <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                      Đổi Key
                    </button>
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
              Nhật Ký 20 Cuộc Gọi Gần Nhất
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
                  <th class="px-3.5 py-2.5">Model</th>
                  <th class="px-3.5 py-2.5 text-right">Prompt / Completion</th>
                  <th class="px-3.5 py-2.5 text-right">Total Tokens</th>
                  <th class="px-3.5 py-2.5 text-right">Độ trễ</th>
                  <th class="px-3.5 py-2.5 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5 text-zinc-300 font-mono">
                ${recentLogs && recentLogs.length > 0 ? recentLogs.map(log => {
                  const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '--:--:--';
                  let statusBadge = `<span class="text-emerald-400">200 OK</span>`;
                  if (log.statusCode === 429) {
                    statusBadge = `<span class="text-amber-400 font-bold">429 RATE LIMIT</span>`;
                  } else if (log.statusCode >= 400) {
                    statusBadge = `<span class="text-rose-400 font-bold">${log.statusCode} ERR</span>`;
                  }

                  return `
                    <tr class="hover:bg-white/[0.02] transition-colors">
                      <td class="px-3.5 py-2 text-zinc-400">${timeStr}</td>
                      <td class="px-3.5 py-2 text-zinc-200 font-sans font-medium">${log.module}</td>
                      <td class="px-3.5 py-2 text-zinc-400">${log.model}</td>
                      <td class="px-3.5 py-2 text-right text-zinc-400">${log.promptTokens} / ${log.completionTokens}</td>
                      <td class="px-3.5 py-2 text-right font-bold text-orange-400">${log.totalTokens}</td>
                      <td class="px-3.5 py-2 text-right text-zinc-400">${log.latencyMs}ms</td>
                      <td class="px-3.5 py-2 text-center">${statusBadge}</td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="7" class="px-4 py-8 text-center text-zinc-500 font-sans">
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
 * Attaches event listeners for AI test ping and key update buttons
 */
export function attachAiAgentsListeners(containerEl, onRefresh) {
  if (!containerEl) return;

  // 1. Refresh Button
  const btnRefresh = containerEl.querySelector('#btnRefreshAiMetrics');
  if (btnRefresh && onRefresh) {
    btnRefresh.addEventListener('click', onRefresh);
  }

  // 2. Test Ping Buttons
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

  // 3. Update Key Buttons
  const updateButtons = containerEl.querySelectorAll('.btn-update-ai-key');
  updateButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const keyId = btn.dataset.keyId;
      const keyName = btn.dataset.keyName;
      const curModel = btn.dataset.keyModel;
      const curBaseUrl = btn.dataset.keyBaseurl;

      const newKey = window.prompt(`Nhập API Key mới cho ${keyName}:`);
      if (!newKey) return; // Cancelled

      try {
        const resp = await fetch('/api/v1/admin/ai/keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getStorageAuthHeaders()
          },
          body: JSON.stringify({
            id: keyId,
            apiKey: newKey.trim(),
            model: curModel,
            baseUrl: curBaseUrl
          })
        });

        const json = await resp.json();
        if (json.success) {
          showToast(`Đã cập nhật API Key cho ${keyName}`, 'success');
          if (onRefresh) onRefresh();
        } else {
          showToast(`Cập nhật thất bại: ${json.message}`, 'error');
        }
      } catch (err) {
        showToast(`Lỗi gửi yêu cầu: ${err.message}`, 'error');
      }
    });
  });
}
