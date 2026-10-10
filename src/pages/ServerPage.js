/**
 * SettingsPage Controller (User Preferences & App Installation)
 * Contains only client preferences. All system management & telemetry is moved to Admin Mission Control (#admin).
 */

import { pwaInstall } from '../hooks/usePWAInstall.js';
import { isStandaloneMode, checkForAppUpdate, getSwVersion } from '../utilities/pwa.js';
import {
  isNativeApp,
  getNativeAppVersion,
  checkApkUpdate,
  startApkUpdate,
  listenApkProgress,
  canRequestPackageInstalls,
  installDownloadedApk
} from '../utilities/apkUpdater.js';
import { toggleTheme, getStoredTheme } from '../hooks/useTheme.js';
import { showToast } from '../utilities/toast.js';

export function renderServerPage() {
  const isDark = getStoredTheme() === 'dark';
  const isStandalone = isStandaloneMode();
  const isNative = isNativeApp();

  return `
    <div class="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <i data-lucide="settings" class="w-5 h-5 text-indigo-500 dark:text-indigo-400"></i> Cài đặt & Tùy chọn
        </h2>
      </div>

      <!-- 1. Giao diện & Trải nghiệm -->
      <div class="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.07] space-y-4 shadow-xs">
        <h3 class="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <i data-lucide="palette" class="w-4 h-4 text-indigo-600 dark:text-indigo-400"></i> Giao diện người dùng
        </h3>

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm py-2.5 border-b border-zinc-100 dark:border-white/5">
          <div>
            <p class="font-semibold text-zinc-900 dark:text-zinc-100">Chế độ giao diện</p>
            <p id="serverThemeStatus" class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">${isDark ? 'Giao diện tối' : 'Giao diện sáng'}</p>
          </div>
          <button id="btnServerThemeToggle" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 hover:text-zinc-950 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:text-zinc-200 text-sm font-semibold border border-zinc-200 dark:border-white/10 transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer">
            <i data-lucide="${isDark ? 'sun' : 'moon'}" class="w-4 h-4"></i>
            <span>${isDark ? 'Giao diện sáng' : 'Giao diện tối'}</span>
          </button>
        </div>

        <div class="flex items-center justify-between text-sm py-2">
          <div>
            <p class="font-semibold text-zinc-900 dark:text-zinc-100">Ngôn ngữ hiển thị</p>
          </div>
          <span class="text-zinc-800 dark:text-zinc-200 font-semibold text-sm">Tiếng Việt</span>
        </div>
      </div>

      <!-- 2. Ứng dụng & Cập nhật -->
      <div class="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.07] space-y-4 shadow-xs">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <i data-lucide="smartphone" class="w-4 h-4 text-indigo-600 dark:text-indigo-400"></i> Ứng dụng & Cập nhật
          </h3>
          <span id="badgeAppVersion" class="px-2.5 py-1 rounded-md text-[11px] font-mono ${isNative ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 font-bold' : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.08]'}">
            ...
          </span>
        </div>

        <div class="flex items-center justify-between text-sm py-2 border-b border-zinc-100 dark:border-white/5">
          <div>
            <p class="font-semibold text-zinc-900 dark:text-zinc-100">Trạng thái thiết bị</p>
          </div>
          ${isNative
            ? '<span class="px-2.5 py-1 rounded-md text-[11px] font-mono bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 font-bold">APK NATIVE</span>'
            : isStandalone
            ? '<span class="px-2.5 py-1 rounded-md text-[11px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold">ĐÃ CÀI ĐẶT</span>'
            : '<button id="btnSettingsInstallPwa" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"><i data-lucide="download" class="w-3.5 h-3.5"></i> Cài đặt lên thiết bị</button>'
          }
        </div>

        ${isNative ? `
        <div class="space-y-3 py-2.5 border-b border-zinc-100 dark:border-white/5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div>
              <p class="font-semibold text-zinc-900 dark:text-zinc-100">Cập nhật Android APK</p>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Tự động tải tệp APK mới nhất từ GitHub và cài đặt</p>
            </div>
            <button id="btnCheckAppUpdate" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold border border-indigo-500 transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer">
              <i data-lucide="download-cloud" class="w-3.5 h-3.5"></i> Cập nhật APK
            </button>
          </div>

          <div id="apkUpdateProgressContainer" class="hidden p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 space-y-2.5">
            <div class="flex items-center justify-between text-xs font-medium">
              <span id="apkUpdateStatusText" class="text-zinc-700 dark:text-zinc-300">Đang chuẩn bị tải...</span>
              <span id="apkUpdatePercentText" class="font-mono text-indigo-600 dark:text-indigo-400 font-bold">0%</span>
            </div>
            <div class="w-full h-2 rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden">
              <div id="apkUpdateProgressBar" class="h-full bg-indigo-600 rounded-full transition-all duration-150" style="width: 0%"></div>
            </div>
            <div class="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
              <span id="apkUpdateBytesText">0 MB / 0 MB</span>
              <button id="btnRetryApkInstall" class="hidden text-indigo-600 dark:text-indigo-400 hover:underline font-sans font-semibold cursor-pointer">Cài đặt ngay</button>
            </div>
          </div>
        </div>
        ` : `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm py-2.5 border-b border-zinc-100 dark:border-white/5">
          <div>
            <p class="font-semibold text-zinc-900 dark:text-zinc-100">Kiểm tra phiên bản mới</p>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Tải bản cập nhật mới nhất từ máy chủ</p>
          </div>
          <button id="btnCheckAppUpdate" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:text-zinc-200 text-sm font-semibold border border-zinc-200 dark:border-white/10 transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Kiểm tra cập nhật
          </button>
        </div>
        `}

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm py-2.5">
          <div>
            <p class="font-semibold text-zinc-900 dark:text-zinc-100">Làm mới toàn bộ Cache</p>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Xóa bộ nhớ đệm và tải lại hoàn toàn ứng dụng</p>
          </div>
          <button id="btnForcePurgeUpdate" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-400 text-sm font-semibold border border-amber-200 dark:border-amber-500/20 transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer">
            <i data-lucide="hard-drive-download" class="w-3.5 h-3.5"></i> Xóa Cache & Tải lại
          </button>
        </div>
      </div>

      <!-- 3. Thông tin ứng dụng -->
      <div class="text-center py-4 text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
        <p class="font-bold text-zinc-800 dark:text-zinc-300">DuyDev Studio</p>
        <p class="text-xs text-zinc-500">Nền tảng tiện ích cá nhân & xử lý tệp tốc độ cao</p>
      </div>

    </div>
  `;
}

export function attachServerPageListeners(onRerender) {
  const triggerUpdate = () => {
    if (typeof onRerender === 'function') {
      onRerender();
    } else {
      window.location.reload();
    }
  };

  // 1. Theme toggle
  const btnTheme = document.getElementById('btnServerThemeToggle');
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      toggleTheme();
      triggerUpdate();
    });
  }

  // 2. PWA Install (shown only when not standalone)
  const btnInstall = document.getElementById('btnSettingsInstallPwa');
  if (btnInstall) {
    btnInstall.addEventListener('click', () => {
      pwaInstall.promptInstall();
    });
  }

  // 3. Check for app update
  const btnCheckUpdate = document.getElementById('btnCheckAppUpdate');
  const isNative = isNativeApp();

  if (btnCheckUpdate) {
    if (isNative) {
      const btnRetryInstall = document.getElementById('btnRetryApkInstall');
      if (btnRetryInstall) {
        btnRetryInstall.addEventListener('click', () => {
          installDownloadedApk();
        });
      }

      btnCheckUpdate.addEventListener('click', async () => {
        btnCheckUpdate.disabled = true;
        btnCheckUpdate.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Đang kiểm tra...';
        if (window.lucide) window.lucide.createIcons();

        try {
          const check = await checkApkUpdate();
          const progressContainer = document.getElementById('apkUpdateProgressContainer');
          const statusText = document.getElementById('apkUpdateStatusText');
          const percentText = document.getElementById('apkUpdatePercentText');
          const progressBar = document.getElementById('apkUpdateProgressBar');
          const bytesText = document.getElementById('apkUpdateBytesText');

          if (check.hasUpdate) {
            const sizeMb = (check.apkAsset.size / 1048576).toFixed(1);
            showToast(`Tìm thấy bản phát hành ${check.tagName} (${sizeMb} MB). Bắt đầu tải...`, 'info');
            if (progressContainer) progressContainer.classList.remove('hidden');

            if (!canRequestPackageInstalls()) {
              showToast('Lưu ý: Thiết bị cần quyền cài đặt ứng dụng từ nguồn ngoài', 'warning');
            }

            const cleanup = listenApkProgress({
              onProgress: ({ percent, bytes, total }) => {
                if (percentText) percentText.textContent = `${percent >= 0 ? percent : 0}%`;
                if (progressBar) progressBar.style.width = `${Math.max(0, percent)}%`;
                if (statusText) statusText.textContent = `Đang tải APK (${check.tagName})...`;
                if (bytesText) {
                  const mIn = (bytes / 1048576).toFixed(1);
                  const mTot = total > 0 ? (total / 1048576).toFixed(1) : sizeMb;
                  bytesText.textContent = `${mIn} MB / ${mTot} MB`;
                }
              },
              onComplete: () => {
                if (statusText) statusText.textContent = 'Đã tải xong! Đang mở trình cài đặt...';
                if (percentText) percentText.textContent = '100%';
                if (progressBar) progressBar.style.width = '100%';
                if (btnRetryInstall) btnRetryInstall.classList.remove('hidden');
                showToast('Tải hoàn tất! Đang khởi chạy bộ cài đặt hệ thống', 'success');
                btnCheckUpdate.disabled = false;
                btnCheckUpdate.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> Cài đặt APK';
                if (window.lucide) window.lucide.createIcons();
                cleanup();
              },
              onError: (err) => {
                if (statusText) statusText.textContent = `Lỗi tải: ${err.message || 'Lỗi mạng'}`;
                showToast(`Không thể tải APK: ${err.message || 'Lỗi mạng'}`, 'error');
                btnCheckUpdate.disabled = false;
                btnCheckUpdate.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Thử lại';
                if (window.lucide) window.lucide.createIcons();
                cleanup();
              }
            });

            startApkUpdate(check.apkAsset.downloadUrl);
          } else {
            showToast(`Bạn đang sử dụng phiên bản APK mới nhất (${check.currentVersion})`, 'success');
            btnCheckUpdate.disabled = false;
            btnCheckUpdate.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> Đã là bản mới nhất';
            if (window.lucide) window.lucide.createIcons();
            setTimeout(() => {
              btnCheckUpdate.innerHTML = '<i data-lucide="download-cloud" class="w-3.5 h-3.5"></i> Cập nhật APK';
              if (window.lucide) window.lucide.createIcons();
            }, 3000);
          }
        } catch (err) {
          showToast(`Lỗi kiểm tra cập nhật: ${err.message}`, 'error');
          btnCheckUpdate.disabled = false;
          btnCheckUpdate.innerHTML = '<i data-lucide="download-cloud" class="w-3.5 h-3.5"></i> Cập nhật APK';
          if (window.lucide) window.lucide.createIcons();
        }
      });
    } else {
      btnCheckUpdate.addEventListener('click', async () => {
        btnCheckUpdate.disabled = true;
        btnCheckUpdate.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Đang kiểm tra...';
        if (window.lucide) window.lucide.createIcons();

        const result = await checkForAppUpdate();
        showToast(result.message, result.updated ? 'success' : 'info');

        if (!result.updated) {
          btnCheckUpdate.disabled = false;
          btnCheckUpdate.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Kiểm tra cập nhật';
          if (window.lucide) window.lucide.createIcons();
        }
      });
    }
  }

  // 4. Force purge cache & reload
  const btnPurge = document.getElementById('btnForcePurgeUpdate');
  if (btnPurge) {
    btnPurge.addEventListener('click', () => {
      if (typeof window.emergencyResetApp === 'function') {
        window.emergencyResetApp();
      } else {
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(() => {});
        window.location.replace(window.location.origin + window.location.pathname + '?clear=' + Date.now());
      }
    });
  }

  // 5. Populate version badge
  const badgeVersion = document.getElementById('badgeAppVersion');
  if (badgeVersion) {
    if (isNative) {
      badgeVersion.textContent = `v${getNativeAppVersion()} (APK)`;
    } else {
      getSwVersion().then((version) => {
        badgeVersion.textContent = version;
      });
    }
  }
}
