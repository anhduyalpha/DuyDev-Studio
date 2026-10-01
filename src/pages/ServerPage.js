/**
 * SettingsPage Controller (User Preferences, Admin Protection & App Installation)
 */

import { pwaInstall } from '../hooks/usePWAInstall.js';
import { isStandaloneMode, checkForAppUpdate, getSwVersion } from '../utilities/pwa.js';
import { toggleTheme, getStoredTheme } from '../hooks/useTheme.js';
import { showToast } from '../utilities/toast.js';
import { clearAllModuleStates } from '../utilities/moduleState.js';
import { 
  isAdminAuthenticated, 
  verifyAdminPassword, 
  lockAdminSession, 
  showChangePasswordModal 
} from '../utilities/adminAuth.js';

export function renderServerPage() {
  const isDark = getStoredTheme() === 'dark';
  const isAdmin = isAdminAuthenticated();
  const isStandalone = isStandaloneMode();

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
            <p id="serverThemeStatus" class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">${isDark ? 'Đang bật: Giao diện tối' : 'Đang bật: Giao diện sáng'}</p>
          </div>
          <button id="btnServerThemeToggle" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 hover:text-zinc-950 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:text-zinc-200 text-sm font-semibold border border-zinc-200 dark:border-white/10 transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer">
            <i data-lucide="${isDark ? 'sun' : 'moon'}" class="w-4 h-4"></i>
            <span>${isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}</span>
          </button>
        </div>

        <div class="flex items-center justify-between text-sm py-2">
          <div>
            <p class="font-semibold text-zinc-900 dark:text-zinc-100">Ngôn ngữ hiển thị</p>
          </div>
          <span class="text-zinc-800 dark:text-zinc-200 font-semibold text-sm">Tiếng Việt</span>
        </div>
      </div>

      <!-- 2. Quản trị Dữ liệu & Hệ thống (Bảo vệ bằng mật khẩu Admin) -->
      <div class="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.07] space-y-4 shadow-xs">
        ${!isAdmin ? `
          <!-- Trạng thái đã khóa -->
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <i data-lucide="shield-alert" class="w-4 h-4 text-amber-500"></i> Quyền riêng tư & Dữ liệu
            </h3>
            <span class="px-2.5 py-1 rounded-md text-[11px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold flex items-center gap-1.5">
              <i data-lucide="lock" class="w-3 h-3"></i> ĐÃ KHÓA
            </span>
          </div>

          <div class="p-4 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/80 dark:border-white/[0.05] space-y-3">
            <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <i data-lucide="lock" class="w-3.5 h-3.5 text-amber-500 shrink-0"></i>
              <span>Khu vực dành riêng cho Quản trị viên. Nhập mật khẩu để thao tác dữ liệu và cấu hình hệ thống.</span>
            </div>
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input 
                type="password" 
                id="inputAdminUnlockPassword" 
                placeholder="Nhập mật khẩu quản trị..." 
                class="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-indigo-500 font-sans" 
              />
              <button 
                id="btnAdminUnlockSubmit" 
                class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <i data-lucide="key" class="w-3.5 h-3.5"></i> Mở khóa
              </button>
            </div>
            <p id="adminUnlockError" class="text-[11px] text-red-500 font-medium hidden">Mật khẩu không chính xác</p>
          </div>
        ` : `
          <!-- Trạng thái đã mở khóa -->
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-white/5 pb-3">
            <h3 class="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <i data-lucide="shield-check" class="w-4 h-4 text-emerald-500"></i> Quyền riêng tư & Dữ liệu
            </h3>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-md text-[11px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1.5">
                <i data-lucide="unlock" class="w-3 h-3"></i> QUẢN TRỊ VIÊN
              </span>
              <button id="btnChangeAdminPwd" class="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 transition cursor-pointer">
                Đổi mật khẩu
              </button>
              <button id="btnLockAdminSession" class="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 transition cursor-pointer flex items-center gap-1">
                <i data-lucide="lock" class="w-3 h-3"></i> Khóa
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between text-sm py-2 border-b border-zinc-100 dark:border-white/5">
            <div>
              <p class="font-semibold text-zinc-900 dark:text-zinc-100">Tự động hủy tệp tạm</p>
              <p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">Xóa sạch tệp tải lên khỏi bộ nhớ đệm sau 30 phút</p>
            </div>
            <span class="px-2.5 py-1 rounded-md text-xs font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold">ĐÃ BẬT</span>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm py-2.5 border-b border-zinc-100 dark:border-white/5">
            <div>
              <p class="font-semibold text-zinc-900 dark:text-zinc-100">Bộ nhớ tạm công cụ (Cache State)</p>
              <p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">Xóa sạch các form dữ liệu nháp và cấu hình đã lưu của toàn bộ công cụ</p>
            </div>
            <button id="btnClearAllModuleStates" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 hover:text-zinc-950 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:text-zinc-200 border border-zinc-200 dark:border-white/10 text-sm font-semibold transition shadow-2xs text-center cursor-pointer">
              Đặt lại toàn bộ
            </button>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm py-2">
            <div>
              <p class="font-semibold text-zinc-900 dark:text-zinc-100">Lịch sử tác vụ trên trình duyệt</p>
              <p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">Xóa danh sách các tệp bạn đã từng xử lý gần đây</p>
            </div>
            <button id="btnClearServerHistory" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-sm font-semibold transition shadow-2xs text-center cursor-pointer">
              Xóa lịch sử
            </button>
          </div>
        `}
      </div>

      <!-- 3. Ứng dụng & Cập nhật -->
      <div class="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.07] space-y-4 shadow-xs">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <i data-lucide="smartphone" class="w-4 h-4 text-indigo-600 dark:text-indigo-400"></i> Ứng dụng & Cập nhật
          </h3>
          <span id="badgeAppVersion" class="px-2.5 py-1 rounded-md text-[11px] font-mono bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.08]">
            ...
          </span>
        </div>

        <div class="flex items-center justify-between text-sm py-2 border-b border-zinc-100 dark:border-white/5">
          <div>
            <p class="font-semibold text-zinc-900 dark:text-zinc-100">Trạng thái thiết bị</p>
          </div>
          ${isStandalone
            ? '<span class="px-2.5 py-1 rounded-md text-[11px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold">ĐÃ CÀI ĐẶT</span>'
            : '<button id="btnSettingsInstallPwa" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"><i data-lucide="download" class="w-3.5 h-3.5"></i> Cài đặt lên thiết bị</button>'
          }
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm py-2.5 border-b border-zinc-100 dark:border-white/5">
          <div>
            <p class="font-semibold text-zinc-900 dark:text-zinc-100">Kiểm tra phiên bản mới</p>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Tải bản cập nhật mới nhất từ máy chủ</p>
          </div>
          <button id="btnCheckAppUpdate" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:text-zinc-200 text-sm font-semibold border border-zinc-200 dark:border-white/10 transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Kiểm tra cập nhật
          </button>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm py-2.5">
          <div>
            <p class="font-semibold text-zinc-900 dark:text-zinc-100">Làm mới toàn bộ Cache</p>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Xóa bộ nhớ đệm và tải lại hoàn toàn ứng dụng</p>
          </div>
          <button id="btnForcePurgeUpdate" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-400 text-sm font-semibold border border-amber-200 dark:border-amber-500/20 transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer">
            <i data-lucide="hard-drive-download" class="w-3.5 h-3.5"></i> Xóa Cache & Tải lại
          </button>
        </div>

        ${isStandalone ? `
        <div class="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/50 dark:border-white/[0.04] text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
          Icon trên màn hình chính do hệ điều hành quản lý (WebAPK). Để cập nhật icon, gỡ cài đặt và thêm lại ứng dụng.
        </div>` : ''}
      </div>

      <!-- 4. Thông tin ứng dụng & Homeserver -->
      <div class="text-center py-4 text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
        <p class="font-bold text-zinc-800 dark:text-zinc-300">DuyDev Studio • Self-Hosted & Cloudflare Tunnel Edition</p>
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

  // 2. Admin unlock submission
  const btnUnlock = document.getElementById('btnAdminUnlockSubmit');
  const inputUnlock = document.getElementById('inputAdminUnlockPassword');
  const errorUnlock = document.getElementById('adminUnlockError');

  const handleUnlock = async () => {
    if (!inputUnlock) return;
    const ok = await verifyAdminPassword(inputUnlock.value);
    if (ok) {
      showToast('Đã mở khóa Quản trị viên', 'success');
      triggerUpdate();
    } else {
      if (errorUnlock) errorUnlock.classList.remove('hidden');
      inputUnlock.classList.add('border-red-500');
      inputUnlock.focus();
      inputUnlock.select();
    }
  };

  if (btnUnlock) btnUnlock.onclick = handleUnlock;
  if (inputUnlock) {
    inputUnlock.onkeydown = (e) => {
      if (e.key === 'Enter') handleUnlock();
    };
  }

  // 3. Admin lock session
  const btnLock = document.getElementById('btnLockAdminSession');
  if (btnLock) {
    btnLock.onclick = () => {
      lockAdminSession();
      showToast('Đã khóa phiên Quản trị', 'info');
      triggerUpdate();
    };
  }

  // 4. Change admin password
  const btnChangePwd = document.getElementById('btnChangeAdminPwd');
  if (btnChangePwd) {
    btnChangePwd.onclick = () => {
      showChangePasswordModal(() => {
        triggerUpdate();
      });
    };
  }

  // 5. Clear history
  const btnClear = document.getElementById('btnClearServerHistory');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      localStorage.removeItem('ds_job_history_v2');
      showToast('Đã xoá lịch sử tác vụ', 'info');
    });
  }

  // 6. Reset all module states
  const btnClearState = document.getElementById('btnClearAllModuleStates');
  if (btnClearState) {
    btnClearState.addEventListener('click', () => {
      clearAllModuleStates();
      showToast('Đã đặt lại dữ liệu công cụ', 'info');
      setTimeout(() => window.location.reload(), 300);
    });
  }

  // 7. PWA Install (shown only when not standalone)
  const btnInstall = document.getElementById('btnSettingsInstallPwa');
  if (btnInstall) {
    btnInstall.addEventListener('click', () => {
      pwaInstall.promptInstall();
    });
  }

  // 8. Check for app update
  const btnCheckUpdate = document.getElementById('btnCheckAppUpdate');
  if (btnCheckUpdate) {
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
      // If updated, controllerchange listener in pwa.js will auto-reload
    });
  }

  // 9. Force purge cache & reload (reuse emergencyResetApp from index.html)
  const btnPurge = document.getElementById('btnForcePurgeUpdate');
  if (btnPurge) {
    btnPurge.addEventListener('click', () => {
      if (typeof window.emergencyResetApp === 'function') {
        window.emergencyResetApp();
      } else {
        // Fallback: manual cache purge
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(() => {});
        window.location.replace(window.location.origin + window.location.pathname + '?clear=' + Date.now());
      }
    });
  }

  // 10. Populate version badge from Service Worker
  const badgeVersion = document.getElementById('badgeAppVersion');
  if (badgeVersion) {
    getSwVersion().then((version) => {
      badgeVersion.textContent = version;
    });
  }
}
