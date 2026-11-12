/**
 * ProfileModal.js - User Profile & Avatar Setup Modal
 * Supports both Step-by-Step Onboarding (Name -> "Bạn có muốn đổi avatar không?")
 * and Direct Profile Editing from the Header Avatar.
 */

import {
  getUserProfile,
  saveUserProfile,
  AVATAR_PRESETS,
  getPresetEmoji,
  getInitialLetter,
  getAvatarGradient,
  renderAvatarInnerHtml,
  compressAvatarImage
} from '../../utilities/userProfile.js';
import { showToast } from '../../utilities/toast.js';
import { getDeviceId } from '../../utilities/deviceId.js';
import { storage } from '../../utilities/storage.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let activeModalEl = null;

/**
 * Opens Profile Modal
 * @param {Object} options
 * @param {boolean} options.isOnboarding - If true, displays the onboarding 2-step flow
 * @param {'profile' | 'sync'} [options.initialTab] - Initial active tab in edit mode
 * @param {Function} options.onComplete - Callback when profile is saved
 */
export function openProfileModal(options = {}) {
  const isOnboarding = Boolean(options.isOnboarding);
  let activeTab = (!isOnboarding && options.initialTab === 'sync') ? 'sync' : 'profile';
  const currentProfile = getUserProfile();

  // If modal already exists, remove it
  closeProfileModal();

  let currentStep = isOnboarding ? 1 : 2; // Step 1: Name, Step 2: Avatar (or combined in edit mode)
  let pendingName = currentProfile.name || '';
  let pendingAvatar = currentProfile.avatar || '';

  // Device Sync State
  let syncStatus = null;
  let isLoadingSync = false;
  let generatedCodeData = null;
  let countdownText = '';
  let countdownTimer = null;
  let isGenerating = false;
  let isRedeeming = false;

  async function fetchSyncStatus() {
    isLoadingSync = true;
    try {
      const deviceId = getDeviceId();
      const res = await fetch('/api/v1/device/sync/status', {
        headers: { 'x-device-id': deviceId }
      });
      if (res.ok) {
        const json = await res.json();
        syncStatus = json.data;
      }
    } catch (err) {
      console.warn('[Sync] Failed to fetch sync status', err);
    } finally {
      isLoadingSync = false;
    }
  }

  function startCountdown(expiresAt) {
    if (countdownTimer) clearInterval(countdownTimer);
    let pollTick = 0;
    const update = async () => {
      const left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      if (left <= 0) {
        countdownText = 'Mã đã hết hạn';
        if (countdownTimer) {
          clearInterval(countdownTimer);
          countdownTimer = null;
        }
        generatedCodeData = null;
        renderModalContent();
        return;
      }

      const m = Math.floor(left / 60).toString().padStart(2, '0');
      const s = (left % 60).toString().padStart(2, '0');
      countdownText = `Hết hạn sau ${m}:${s}`;
      const timerEl = modalOverlay.querySelector('#dsSyncTimerDisplay');
      if (timerEl) timerEl.textContent = countdownText;

      // Poll sync status every 3 seconds to auto-detect when remote device redeems the OTC code
      pollTick++;
      if (pollTick % 3 === 0) {
        try {
          await fetchSyncStatus();
          const isNowLinked = syncStatus?.isLinked || (syncStatus?.totalLinked && syncStatus.totalLinked > 1);
          if (isNowLinked && !syncStatus?.activeCode) {
            if (countdownTimer) {
              clearInterval(countdownTimer);
              countdownTimer = null;
            }
            generatedCodeData = null;
            showToast('Thiết bị mới đã liên kết thành công!', 'success');
            await storage.syncAllWithServer({ replaceLocal: true }).catch(() => {});
            renderModalContent();
          }
        } catch {}
      }
    };
    update();
    countdownTimer = setInterval(update, 1000);
  }

  async function generateSyncCode() {
    if (isGenerating) return;
    isGenerating = true;
    renderModalContent();
    try {
      // Ensure phone/current device flushes local history to backend before issuing code
      await storage.pushLocalHistoryToServer().catch(() => {});
      const deviceId = getDeviceId();
      const res = await fetch('/api/v1/device/sync/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-id': deviceId },
        body: JSON.stringify({ deviceId })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        generatedCodeData = json.data;
        startCountdown(json.data.expiresAt);
        showToast('Mã đồng bộ đã được tạo!', 'success');
      } else {
        showToast(json.message || 'Không thể tạo mã đồng bộ', 'error');
      }
    } catch (err) {
      showToast('Lỗi mạng khi tạo mã đồng bộ', 'error');
    } finally {
      isGenerating = false;
      renderModalContent();
    }
  }

  async function redeemSyncCode(code) {
    if (!code || code.length !== 6) {
      showToast('Vui lòng nhập đủ mã 6 chữ số', 'error');
      return;
    }
    if (isRedeeming) return;
    isRedeeming = true;
    renderModalContent();
    try {
      // Push any local history before linking
      await storage.pushLocalHistoryToServer().catch(() => {});
      const deviceId = getDeviceId();
      const res = await fetch('/api/v1/device/sync/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-id': deviceId },
        body: JSON.stringify({ deviceId, code })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Liên kết thiết bị thành công! Đang đồng bộ...', 'success');
        await storage.syncAllWithServer({ replaceLocal: true }).catch(() => {});
        await fetchSyncStatus();
        showToast('Đã hoàn tất đồng bộ lịch sử giữa các thiết bị!', 'success');
      } else {
        showToast(json.message || 'Mã không hợp lệ hoặc đã hết hạn', 'error');
      }
    } catch (err) {
      showToast('Lỗi kết nối khi đồng bộ', 'error');
    } finally {
      isRedeeming = false;
      renderModalContent();
    }
  }

  async function unlinkDevice(targetDeviceId) {
    try {
      const deviceId = getDeviceId();
      const res = await fetch('/api/v1/device/sync/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-id': deviceId },
        body: JSON.stringify({ requestDeviceId: deviceId, targetDeviceId })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Đã hủy liên kết thiết bị', 'success');
        await storage.syncAllWithServer({ replaceLocal: true }).catch(() => {});
        await fetchSyncStatus();
      } else {
        showToast(json.message || 'Không thể hủy liên kết', 'error');
      }
    } catch (err) {
      showToast('Lỗi khi hủy liên kết thiết bị', 'error');
    } finally {
      renderModalContent();
    }
  }

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'dsProfileModalOverlay';
  modalOverlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/25 dark:bg-black/60 backdrop-blur-2xl animate-fade-in select-none overflow-x-hidden';
  modalOverlay.style.webkitBackdropFilter = 'blur(28px) saturate(180%)';

  function renderModalContent() {
    const isSyncTab = !isOnboarding && activeTab === 'sync';
    const isStep1 = !isSyncTab && currentStep === 1;
    const initialLetter = getInitialLetter(pendingName);
    const gradientClass = getAvatarGradient(pendingName);

    const deviceList = syncStatus?.devices || syncStatus?.linkedDevices || [];
    const linkedCount = syncStatus?.totalLinked ?? deviceList.length ?? (syncStatus?.isLinked ? 2 : 1);

    modalOverlay.innerHTML = `
      <div 
        id="dsProfileModalCard" 
        class="relative w-full max-w-[calc(100vw-24px)] sm:max-w-[440px] ${isSyncTab ? 'sm:max-w-[480px]' : ''} max-h-[calc(100dvh-32px)] sm:max-h-[calc(100dvh-48px)] flex flex-col bg-white/95 dark:bg-zinc-900/90 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-3xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.04),inset_0_1px_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_1px_0_rgba(255,255,255,0.12)] p-4 sm:p-6 overflow-hidden transition-all duration-200 box-border isolate"
        style="-webkit-backdrop-filter: blur(32px) saturate(190%);"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dsProfileModalTitle"
      >
        <!-- Top Apple Specular Sheen -->
        <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/40 dark:via-indigo-400/50 to-transparent"></div>

        <!-- Header Row: Tabs + Close Button (Eliminates overlap on both PC and Android) -->
        ${!isOnboarding ? `
          <div class="flex items-center gap-2 mb-3.5 sm:mb-4 shrink-0">
            <div class="flex-1 min-w-0 flex items-center gap-1 p-1 bg-zinc-100/90 dark:bg-zinc-800/80 border border-zinc-200/70 dark:border-white/10 rounded-2xl text-xs font-semibold">
              <button 
                type="button" 
                id="dsTabProfileBtn"
                class="flex-1 min-w-0 h-9 px-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${!isSyncTab ? 'bg-white dark:bg-zinc-700/80 text-zinc-900 dark:text-zinc-50 shadow-xs' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}"
              >
                <i data-lucide="user" class="w-3.5 h-3.5 shrink-0"></i>
                <span class="truncate sm:hidden">Hồ sơ</span>
                <span class="truncate hidden sm:inline">Hồ sơ cá nhân</span>
              </button>
              <button 
                type="button" 
                id="dsTabSyncBtn"
                class="flex-1 min-w-0 h-9 px-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${isSyncTab ? 'bg-white dark:bg-zinc-700/80 text-zinc-900 dark:text-zinc-50 shadow-xs' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}"
              >
                <i data-lucide="smartphone" class="w-3.5 h-3.5 shrink-0"></i>
                <span class="truncate sm:hidden">Đồng bộ</span>
                <span class="truncate hidden sm:inline">Đồng bộ thiết bị</span>
                ${syncStatus?.isLinked ? `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>` : ''}
              </button>
            </div>
            <button 
              type="button" 
              id="dsProfileCloseBtn"
              class="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl shrink-0 flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 bg-zinc-100/90 dark:bg-zinc-800/80 border border-zinc-200/70 dark:border-white/10 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 transition cursor-pointer active:scale-95"
              aria-label="Đóng"
            >
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        ` : `
          <!-- Onboarding Header with Close Button -->
          <div class="flex items-center justify-between mb-4 shrink-0">
            <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Thiết lập tài khoản</span>
            <button 
              type="button" 
              id="dsProfileCloseBtn"
              class="w-9 h-9 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 transition cursor-pointer"
              aria-label="Đóng"
            >
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        `}

        ${isSyncTab ? `
          <!-- ================= SYNC TAB: ĐỒNG BỘ THIẾT BỊ ================= -->
          <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain pr-0.5 space-y-3.5 sm:space-y-4 pt-0.5">
            <div class="flex items-start sm:items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/25 flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                <i data-lucide="refresh-cw" class="w-5 h-5"></i>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 id="dsProfileModalTitle" class="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                    Đồng bộ thiết bị
                  </h3>
                  ${syncStatus?.isLinked ? `
                    <span class="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-full shrink-0">
                      Đã ghép nối (${linkedCount} thiết bị)
                    </span>
                  ` : `
                    <span class="px-2 py-0.5 text-[10px] font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 rounded-full shrink-0">
                      Chưa ghép nối
                    </span>
                  `}
                </div>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  Chia sẻ lịch sử xử lý file và thùng rác qua mã một lần (OTC)
                </p>
              </div>
            </div>

            <!-- BLOCK 1: TẠO MÃ TRÊN THIẾT BỊ NÀY -->
            <div class="p-3.5 sm:p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-white/5 space-y-2.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  <i data-lucide="key" class="w-3.5 h-3.5 text-indigo-500 shrink-0"></i>
                  <span>Mã kết nối từ thiết bị này</span>
                </div>
                ${generatedCodeData ? `
                  <span id="dsSyncTimerDisplay" class="text-[11px] font-mono font-medium text-amber-600 dark:text-amber-400">
                    ${countdownText || 'Hết hạn sau 05:00'}
                  </span>
                ` : ''}
              </div>

              ${generatedCodeData ? `
                <div class="flex items-center justify-between gap-3 p-3 bg-white dark:bg-zinc-900/90 border border-indigo-200 dark:border-indigo-500/30 rounded-xl shadow-xs">
                  <div class="text-2xl font-black font-mono tracking-[0.25em] text-zinc-900 dark:text-zinc-50 pl-1 select-all">
                    ${generatedCodeData.code}
                  </div>
                  <button 
                    type="button" 
                    id="dsCopySyncCodeBtn"
                    class="h-9 px-3 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/20 dark:hover:bg-indigo-500/30 text-indigo-600 dark:text-indigo-300 transition cursor-pointer flex items-center gap-1.5 shrink-0"
                    title="Sao chép mã"
                  >
                    <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                    <span>Sao chép</span>
                  </button>
                </div>
                <p class="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                  Nhập mã 6 số này trên thiết bị khác để liên kết lịch sử. Mã có hiệu lực trong 5 phút.
                </p>
              ` : `
                <button 
                  type="button" 
                  id="dsGenerateSyncCodeBtn"
                  ${isGenerating ? 'disabled' : ''}
                  class="w-full h-11 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
                >
                  <i data-lucide="qr-code" class="w-4 h-4"></i>
                  <span>${isGenerating ? 'Đang tạo mã...' : 'Tạo mã kết nối (6 số)'}</span>
                </button>
              `}
            </div>

            <!-- BLOCK 2: NHẬP MÃ TỪ THIẾT BỊ KHÁC -->
            <div class="p-3.5 sm:p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-white/5 space-y-2.5">
              <div class="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                <i data-lucide="link-2" class="w-3.5 h-3.5 text-indigo-500 shrink-0"></i>
                <span>Nhập mã từ thiết bị khác</span>
              </div>
              <div class="flex items-center gap-2 min-w-0 w-full">
                <input 
                  type="text" 
                  id="dsInputSyncCode"
                  maxlength="6"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  placeholder="6 chữ số..."
                  class="flex-1 min-w-0 w-full h-11 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-center font-mono text-base font-bold tracking-[0.15em] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 placeholder:tracking-normal placeholder:font-sans placeholder:text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition uppercase"
                />
                <button 
                  type="button" 
                  id="dsSubmitSyncCodeBtn"
                  ${isRedeeming ? 'disabled' : ''}
                  class="h-11 px-3.5 sm:px-4 rounded-xl text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shrink-0 whitespace-nowrap active:scale-95"
                >
                  <i data-lucide="check" class="w-4 h-4 shrink-0"></i>
                  <span>${isRedeeming ? 'Đang ghép...' : 'Liên kết'}</span>
                </button>
              </div>
            </div>

            <!-- BLOCK 3: DANH SÁCH THIẾT BỊ ĐÃ LIÊN KẾT -->
            ${deviceList.length > 0 ? `
              <div class="space-y-2 pt-1">
                <div class="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <span>Thiết bị trong nhóm (${deviceList.length})</span>
                  <span class="text-[10px] text-zinc-400 font-mono">Nhóm: ${syncStatus?.syncGroupId ? syncStatus.syncGroupId.slice(-8) : 'Cục bộ'}</span>
                </div>
                <div class="max-h-48 overflow-y-auto custom-scrollbar overscroll-contain space-y-1.5 pr-0.5">
                  ${deviceList.map(dev => {
                    const isCurrent = dev.deviceId === syncStatus?.currentDeviceId || dev.isCurrent;
                    return `
                      <div class="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50/60 dark:bg-zinc-800/30 border border-zinc-200/50 dark:border-white/5 text-xs">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <div class="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700/60 flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0">
                            <i data-lucide="${(dev.deviceSummary || '').includes('Mobile') || (dev.deviceSummary || '').includes('Android') || (dev.deviceSummary || '').includes('iPhone') ? 'smartphone' : 'laptop'}" class="w-4 h-4"></i>
                          </div>
                          <div class="min-w-0">
                            <div class="font-semibold text-zinc-800 dark:text-zinc-200 truncate flex items-center gap-1.5">
                              <span class="truncate">${escapeHtml(dev.alias || 'Thiết bị')}</span>
                              ${isCurrent ? `<span class="px-1.5 py-0.2 text-[9px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded shrink-0">Bạn</span>` : ''}
                            </div>
                            <div class="text-[10px] text-zinc-400 truncate">
                              ${dev.maskedId || ''} · ${dev.deviceSummary || 'Web Client'}
                            </div>
                          </div>
                        </div>
                        ${!isCurrent ? `
                          <button 
                            type="button" 
                            class="btn-unlink-device p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition cursor-pointer shrink-0"
                            data-device-id="${dev.deviceId}"
                            title="Hủy liên kết thiết bị này"
                          >
                            <i data-lucide="unlink" class="w-3.5 h-3.5"></i>
                          </button>
                        ` : `
                          <button 
                            type="button" 
                            class="btn-unlink-device px-2.5 py-1 rounded-lg text-[10px] font-medium text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition cursor-pointer shrink-0"
                            data-device-id="${dev.deviceId}"
                            title="Rời nhóm đồng bộ"
                          >
                            Rời nhóm
                          </button>
                        `}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}

            <div class="pt-1">
              <button 
                type="button" 
                id="dsSyncCloseModalBtn"
                class="w-full h-11 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100/80 dark:bg-zinc-800/80 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 transition cursor-pointer active:scale-[0.99]"
              >
                Đóng
              </button>
            </div>
          </div>
        ` : isStep1 ? `
          <!-- ================= STEP 1: NHẬP TÊN PROFILE ================= -->
          <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain pr-0.5 space-y-4 pt-1">
            <div class="flex items-center gap-3.5 min-w-0">
              <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/25 flex items-center justify-center shrink-0 shadow-xs">
                <i data-lucide="user" class="w-5 h-5"></i>
              </div>
              <div class="min-w-0 flex-1">
                <h3 id="dsProfileModalTitle" class="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50 tracking-tight truncate">
                  ${isOnboarding ? 'Chào mừng bạn đến với Studio' : 'Tên hồ sơ của bạn'}
                </h3>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  ${isOnboarding ? 'Hệ thống yêu cầu định danh thiết bị để lưu trữ lịch sử' : 'Nhập tên để lưu lịch sử và hiển thị khi tải tài liệu'}
                </p>
              </div>
            </div>

            <!-- Mandatory Gate Notice -->
            ${isOnboarding ? `
              <div class="px-3.5 py-2.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-500/20 flex items-center gap-2.5 text-xs text-indigo-950 dark:text-indigo-200 font-medium">
                <i data-lucide="shield-check" class="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400"></i>
                <span>Vui lòng nhập tên của bạn để tiếp tục sử dụng hệ thống</span>
              </div>
            ` : ''}

            <!-- Name Input Field -->
            <div class="space-y-1.5 pt-1">
              <label for="dsProfileNameInput" class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Tên profile của bạn <span class="text-rose-500">*</span>
              </label>
              <div class="relative">
                <input 
                  type="text" 
                  id="dsProfileNameInput" 
                  value="${escapeHtml(pendingName)}" 
                  placeholder="Ví dụ: Hải Nam, Minh Trang, Duy IT..." 
                  maxlength="40"
                  class="w-full h-12 px-4 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-white/10 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/80 focus:bg-white dark:focus:bg-zinc-800 transition shadow-2xs"
                  autofocus
                />
              </div>
              <p id="dsProfileNameError" class="hidden text-xs text-rose-500 font-medium"></p>
            </div>

            <!-- Action Buttons for Step 1 -->
            <div class="flex items-center gap-2.5 pt-2 min-w-0">
              <button 
                type="button" 
                id="dsProfileSkipBtn"
                class="px-4 h-12 rounded-xl text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100/80 dark:bg-zinc-800/80 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 transition cursor-pointer shrink-0"
              >
                ${isOnboarding ? 'Để sau' : 'Hủy'}
              </button>
              <button 
                type="button" 
                id="dsProfileNextStepBtn"
                class="flex-1 min-w-0 h-12 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/25 active:scale-[0.98] transition cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <span class="truncate">Tiếp tục</span>
                <i data-lucide="arrow-right" class="w-4 h-4 shrink-0"></i>
              </button>
            </div>
          </div>
        ` : `
          <!-- ================= STEP 2: ĐỔI AVATAR (HOẶC EDIT PROFILE) ================= -->
          <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain pr-0.5 space-y-4 pt-1">
            <div class="flex items-center gap-3.5">
              <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/25 flex items-center justify-center shrink-0 shadow-xs">
                <i data-lucide="sparkles" class="w-5 h-5"></i>
              </div>
              <div class="min-w-0 flex-1">
                <h3 id="dsProfileModalTitle" class="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                  ${isOnboarding ? 'Bạn có muốn đổi avatar không?' : 'Chỉnh sửa hồ sơ & Avatar'}
                </h3>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  Chọn biểu tượng cá tính hoặc tải ảnh từ máy
                </p>
              </div>
            </div>

            <!-- Big Live Avatar Preview with Name Underneath -->
            <div class="flex flex-col items-center justify-center py-3.5 bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-white/5 rounded-2xl shadow-2xs">
              <div id="dsModalAvatarPreview" class="relative w-18 h-18 sm:w-20 sm:h-20 rounded-full overflow-hidden flex items-center justify-center font-bold text-2xl sm:text-3xl shadow-sm border-2 border-white dark:border-zinc-700 bg-gradient-to-tr ${gradientClass}">
                ${renderAvatarInnerHtml(pendingAvatar, pendingName)}
              </div>
              <span id="dsModalNamePreview" class="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-2 max-w-[200px] truncate text-center">
                ${escapeHtml(pendingName || 'Người dùng')}
              </span>
              <span class="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                ${currentProfile.deviceId ? `ID: ${currentProfile.deviceId.slice(-8)}` : ''}
              </span>
            </div>

            <!-- Name Input (Allow quick editing name even in Step 2) -->
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label for="dsProfileNameInput2" class="text-[11.5px] font-semibold text-zinc-700 dark:text-zinc-300">
                  Tên hiển thị
                </label>
                <button type="button" id="dsProfileChangeNameQuick" class="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                  Sửa tên
                </button>
              </div>
              <input 
                type="text" 
                id="dsProfileNameInput2" 
                value="${escapeHtml(pendingName)}" 
                placeholder="Nhập tên của bạn..." 
                maxlength="40"
                class="w-full h-10 px-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-white/10 text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
              />
            </div>

            <!-- Preset Avatars Grid -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[11.5px] font-semibold text-zinc-700 dark:text-zinc-300">
                  Biểu tượng có sẵn
                </span>
                <button 
                  type="button" 
                  id="dsProfileResetInitialBtn"
                  class="text-[11px] font-medium text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                  title="Dùng avatar chữ cái"
                >
                  Dùng chữ cái đầu (${initialLetter})
                </button>
              </div>
              <div class="grid grid-cols-6 gap-2">
                ${AVATAR_PRESETS.map(p => {
                  const isSelected = pendingAvatar === p.id;
                  return `
                    <button 
                      type="button" 
                      class="btn-avatar-preset flex flex-col items-center justify-center h-11 rounded-xl border text-xl transition cursor-pointer active:scale-95 ${
                        isSelected 
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 ring-2 ring-indigo-500/30 text-indigo-600 dark:text-indigo-300 shadow-xs' 
                          : 'border-zinc-200/80 dark:border-white/10 bg-white/70 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300'
                      }"
                      data-avatar-id="${p.id}"
                      title="${p.label}"
                    >
                      ${p.emoji}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Upload Custom Photo Button -->
            <div>
              <input type="file" id="dsProfileFileInput" accept="image/*" class="hidden" />
              <button 
                type="button" 
                id="dsProfileUploadPhotoBtn"
                class="w-full h-11 px-3.5 rounded-xl border ${pendingAvatar && (pendingAvatar.startsWith('data:image/') || pendingAvatar.startsWith('http')) ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20' : 'border-dashed border-zinc-300 dark:border-white/20 bg-zinc-50/50 dark:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300'} hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 text-xs font-semibold transition cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <i data-lucide="${pendingAvatar && (pendingAvatar.startsWith('data:image/') || pendingAvatar.startsWith('http')) ? 'check' : 'image-plus'}" class="w-4 h-4 text-indigo-600 dark:text-indigo-400"></i>
                <span>${pendingAvatar && (pendingAvatar.startsWith('data:image/') || pendingAvatar.startsWith('http')) ? '✓ Đã chọn ảnh từ máy (Nhấp để đổi)' : 'Tải ảnh đại diện từ thiết bị'}</span>
              </button>
            </div>

            <!-- Action Buttons for Step 2 -->
            <div class="flex items-center gap-2.5 pt-2">
              ${isOnboarding ? `
                <button 
                  type="button" 
                  id="dsProfileBackToStep1"
                  class="h-12 px-4 rounded-xl text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100/80 dark:bg-zinc-800/80 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 transition cursor-pointer"
                >
                  Quay lại
                </button>
                <button 
                  type="button" 
                  id="dsProfileSkipAvatarBtn"
                  class="flex-1 h-12 px-3.5 rounded-xl text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer text-center"
                >
                  Dùng chữ cái
                </button>
              ` : `
                <button 
                  type="button" 
                  id="dsProfileCancelEditBtn"
                  class="flex-1 h-12 px-4 rounded-xl text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100/80 dark:bg-zinc-800/80 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 transition cursor-pointer"
                >
                  Hủy
                </button>
              `}
              <button 
                type="button" 
                id="dsProfileSaveAllBtn"
                class="flex-[1.4] h-12 px-5 rounded-xl text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/25 active:scale-[0.98] transition cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <i data-lucide="check" class="w-4 h-4"></i>
                <span>${isOnboarding ? 'Hoàn tất' : 'Lưu hồ sơ'}</span>
              </button>
            </div>
          </div>
        `}
      </div>
    `;

    if (window.lucide?.createIcons) {
      window.lucide.createIcons({ root: modalOverlay });
    }

    attachListeners();
  }

  function attachListeners() {
    const handleDismiss = () => {
      if (isOnboarding) {
        try { sessionStorage.setItem('ds_profile_prompt_dismissed', '1'); } catch {}
      }
      closeProfileModal();
    };

    // Close button
    const closeBtn = modalOverlay.querySelector('#dsProfileCloseBtn');
    if (closeBtn) closeBtn.onclick = handleDismiss;

    // Overlay click to close
    modalOverlay.onclick = (e) => {
      if (e.target === modalOverlay) handleDismiss();
    };

    // Top Tab Switcher (Non-onboarding)
    if (!isOnboarding) {
      const tabProfileBtn = modalOverlay.querySelector('#dsTabProfileBtn');
      if (tabProfileBtn) {
        tabProfileBtn.onclick = () => {
          activeTab = 'profile';
          renderModalContent();
        };
      }
      const tabSyncBtn = modalOverlay.querySelector('#dsTabSyncBtn');
      if (tabSyncBtn) {
        tabSyncBtn.onclick = () => {
          activeTab = 'sync';
          storage.pushLocalHistoryToServer().catch(() => {});
          if (!syncStatus && !isLoadingSync) {
            fetchSyncStatus().then(() => renderModalContent());
          } else {
            renderModalContent();
          }
        };
      }
    }

    if (!isOnboarding && activeTab === 'sync') {
      // Sync Tab Listeners
      const genBtn = modalOverlay.querySelector('#dsGenerateSyncCodeBtn');
      if (genBtn) genBtn.onclick = generateSyncCode;

      const copyBtn = modalOverlay.querySelector('#dsCopySyncCodeBtn');
      if (copyBtn && generatedCodeData?.code) {
        copyBtn.onclick = () => {
          try {
            navigator.clipboard?.writeText(generatedCodeData.code);
            showToast('Đã sao chép mã 6 số!', 'success');
          } catch {
            showToast('Không thể sao chép mã', 'error');
          }
        };
      }

      const submitSyncBtn = modalOverlay.querySelector('#dsSubmitSyncCodeBtn');
      const inputSyncCode = modalOverlay.querySelector('#dsInputSyncCode');
      const handleRedeem = () => {
        const val = (inputSyncCode?.value || '').trim();
        redeemSyncCode(val);
      };
      if (submitSyncBtn) submitSyncBtn.onclick = handleRedeem;
      if (inputSyncCode) {
        inputSyncCode.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleRedeem();
          }
        };
      }

      modalOverlay.querySelectorAll('.btn-unlink-device').forEach(btn => {
        btn.onclick = () => {
          const targetId = btn.getAttribute('data-device-id');
          if (targetId) unlinkDevice(targetId);
        };
      });

      const syncCloseBtn = modalOverlay.querySelector('#dsSyncCloseModalBtn');
      if (syncCloseBtn) syncCloseBtn.onclick = closeProfileModal;

      return;
    }

    if (currentStep === 1) {
      const nameInput = modalOverlay.querySelector('#dsProfileNameInput');
      const errorP = modalOverlay.querySelector('#dsProfileNameError');
      const nextBtn = modalOverlay.querySelector('#dsProfileNextStepBtn');
      const skipBtn = modalOverlay.querySelector('#dsProfileSkipBtn');

      const handleNext = () => {
        const val = (nameInput?.value || '').trim();
        if (!val || val.length < 2) {
          if (errorP) {
            errorP.textContent = 'Bắt buộc nhập tên của bạn (tối thiểu 2 ký tự)';
            errorP.classList.remove('hidden');
          }
          nameInput?.focus();
          return;
        }
        if (errorP) errorP.classList.add('hidden');
        pendingName = val;
        currentStep = 2; // Transition to "Bạn có muốn đổi avatar không?"
        renderModalContent();
      };

      if (nextBtn) nextBtn.onclick = handleNext;
      if (nameInput) {
        nameInput.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleNext();
          }
        };
      }

      if (skipBtn) {
        skipBtn.onclick = handleDismiss;
      }
    } else {
      // Step 2 listeners
      const nameInput2 = modalOverlay.querySelector('#dsProfileNameInput2');
      const changeNameQuickBtn = modalOverlay.querySelector('#dsProfileChangeNameQuick');
      const saveBtn = modalOverlay.querySelector('#dsProfileSaveAllBtn');

      const doSave = async () => {
        const finalName = (nameInput2?.value || pendingName || '').trim();
        if (!finalName) {
          showToast('Vui lòng nhập tên của bạn', 'error');
          nameInput2?.focus();
          return;
        }

        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span> Đang lưu...`;
        }

        const saved = await saveUserProfile({
          name: finalName,
          avatar: pendingAvatar
        });

        showToast(`Đã lưu hồ sơ: ${saved.name}`, 'success');
        closeProfileModal();
        if (typeof options.onComplete === 'function') {
          options.onComplete(saved);
        }
      };

      if (changeNameQuickBtn && nameInput2) {
        changeNameQuickBtn.onclick = () => {
          nameInput2.focus();
          nameInput2.select();
        };
      }

      if (nameInput2) {
        nameInput2.oninput = (e) => {
          pendingName = e.target.value.trim();
          const namePreview = modalOverlay.querySelector('#dsModalNamePreview');
          if (namePreview) namePreview.textContent = pendingName || 'Người dùng';
          // Update initial letter if no custom avatar
          if (!pendingAvatar) {
            const avatarPreview = modalOverlay.querySelector('#dsModalAvatarPreview');
            if (avatarPreview) {
              avatarPreview.innerHTML = renderAvatarInnerHtml(pendingAvatar, pendingName);
            }
          }
        };

        nameInput2.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            doSave();
          }
        };
      }

      // Presets
      modalOverlay.querySelectorAll('.btn-avatar-preset').forEach(btn => {
        btn.onclick = () => {
          const avatarId = btn.getAttribute('data-avatar-id');
          pendingAvatar = avatarId;
          renderModalContent();
        };
      });

      // Reset to initial letter
      const resetInitialBtn = modalOverlay.querySelector('#dsProfileResetInitialBtn');
      if (resetInitialBtn) {
        resetInitialBtn.onclick = () => {
          pendingAvatar = '';
          renderModalContent();
        };
      }

      // Upload custom photo from device
      const uploadBtn = modalOverlay.querySelector('#dsProfileUploadPhotoBtn');
      const fileInput = modalOverlay.querySelector('#dsProfileFileInput');
      if (uploadBtn && fileInput) {
        uploadBtn.onclick = () => fileInput.click();
        fileInput.onchange = async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            uploadBtn.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span> Đang xử lý ảnh...`;
            const dataUrl = await compressAvatarImage(file, 128);
            pendingAvatar = dataUrl;
            renderModalContent();
            showToast('Đã chọn ảnh đại diện!', 'success');
          } catch (err) {
            showToast(err.message || 'Lỗi đọc ảnh', 'error');
            renderModalContent();
          }
        };
      }

      // Back to step 1
      const backBtn = modalOverlay.querySelector('#dsProfileBackToStep1');
      if (backBtn) {
        backBtn.onclick = () => {
          currentStep = 1;
          renderModalContent();
        };
      }

      // Skip avatar
      const skipAvatarBtn = modalOverlay.querySelector('#dsProfileSkipAvatarBtn');
      if (skipAvatarBtn) {
        skipAvatarBtn.onclick = async () => {
          pendingAvatar = '';
          await doSave();
        };
      }

      // Cancel edit
      const cancelEditBtn = modalOverlay.querySelector('#dsProfileCancelEditBtn');
      if (cancelEditBtn) cancelEditBtn.onclick = closeProfileModal;

      // Save all
      if (saveBtn) saveBtn.onclick = doSave;
    }
  }

  // Keydown listener for Escape (Strictly forbidden during mandatory onboarding)
  const handleKeydown = (e) => {
    if (isOnboarding) return;
    if (e.key === 'Escape') closeProfileModal();
  };
  document.addEventListener('keydown', handleKeydown);

  modalOverlay._cleanup = () => {
    document.removeEventListener('keydown', handleKeydown);
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  };

  document.body.appendChild(modalOverlay);
  activeModalEl = modalOverlay;

  if (activeTab === 'sync' && !syncStatus && !isLoadingSync) {
    fetchSyncStatus().then(() => renderModalContent());
  }

  renderModalContent();
}

export function closeProfileModal() {
  if (activeModalEl) {
    if (typeof activeModalEl._cleanup === 'function') activeModalEl._cleanup();
    activeModalEl.remove();
    activeModalEl = null;
  }
}
