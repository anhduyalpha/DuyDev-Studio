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
 * @param {Function} options.onComplete - Callback when profile is saved
 */
export function openProfileModal(options = {}) {
  const isOnboarding = Boolean(options.isOnboarding);
  const currentProfile = getUserProfile();

  // If modal already exists, remove it
  closeProfileModal();

  let currentStep = isOnboarding ? 1 : 2; // Step 1: Name, Step 2: Avatar (or combined in edit mode)
  let pendingName = currentProfile.name || '';
  let pendingAvatar = currentProfile.avatar || '';

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'dsProfileModalOverlay';
  modalOverlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none';

  function renderModalContent() {
    const isStep1 = currentStep === 1;
    const initialLetter = getInitialLetter(pendingName);
    const gradientClass = getAvatarGradient(pendingName);

    modalOverlay.innerHTML = `
      <div 
        id="dsProfileModalCard" 
        class="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-2xl p-5 sm:p-6 overflow-hidden transition-all duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dsProfileModalTitle"
      >
        <!-- Top Accent Bar -->
        <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-indigo-500 to-purple-500"></div>

        <!-- Close Button (if not strictly required) -->
        <button 
          type="button" 
          id="dsProfileCloseBtn"
          class="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition cursor-pointer"
          aria-label="Đóng"
        >
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>

        ${isStep1 ? `
          <!-- ================= STEP 1: NHẬP TÊN PROFILE ================= -->
          <div class="space-y-4 pt-1">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                <i data-lucide="user" class="w-5 h-5"></i>
              </div>
              <div>
                <h3 id="dsProfileModalTitle" class="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  ${isOnboarding ? 'Chào mừng bạn đến với Studio' : 'Tên hồ sơ của bạn'}
                </h3>
                <p class="text-xs text-zinc-500 dark:text-zinc-400">
                  Nhập tên để lưu lịch sử và hiển thị khi tải tài liệu
                </p>
              </div>
            </div>

            <!-- Name Input Field -->
            <div class="space-y-1.5 pt-2">
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
                  class="w-full h-11 px-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/80 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition"
                  autofocus
                />
              </div>
              <p id="dsProfileNameError" class="hidden text-xs text-rose-500 font-medium"></p>
            </div>

            <!-- Action Buttons for Step 1 -->
            <div class="flex items-center gap-2.5 pt-3">
              ${isOnboarding ? `
                <button 
                  type="button" 
                  id="dsProfileSkipBtn"
                  class="flex-1 h-11 px-4 rounded-xl text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Để sau
                </button>
              ` : `
                <button 
                  type="button" 
                  id="dsProfileSkipBtn"
                  class="flex-1 h-11 px-4 rounded-xl text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Hủy
                </button>
              `}
              <button 
                type="button" 
                id="dsProfileNextStepBtn"
                class="flex-[1.4] h-11 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-md shadow-orange-500/20 active:scale-[0.98] transition cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <span>Tiếp tục</span>
                <i data-lucide="arrow-right" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        ` : `
          <!-- ================= STEP 2: ĐỔI AVATAR (HOẶC EDIT PROFILE) ================= -->
          <div class="space-y-4 pt-1">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <i data-lucide="sparkles" class="w-5 h-5"></i>
              </div>
              <div class="min-w-0 flex-1">
                <h3 id="dsProfileModalTitle" class="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  ${isOnboarding ? 'Bạn có muốn đổi avatar không?' : 'Chỉnh sửa hồ sơ & Avatar'}
                </h3>
                <p class="text-xs text-zinc-500 dark:text-zinc-400">
                  Chọn biểu tượng cá tính hoặc tải ảnh từ máy
                </p>
              </div>
            </div>

            <!-- Big Live Avatar Preview with Name Underneath -->
            <div class="flex flex-col items-center justify-center py-2.5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 rounded-xl">
              <div id="dsModalAvatarPreview" class="relative w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden flex items-center justify-center font-bold text-xl sm:text-2xl shadow-sm border-2 border-white dark:border-zinc-700 bg-gradient-to-tr ${gradientClass}">
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
                <button type="button" id="dsProfileChangeNameQuick" class="text-[11px] text-orange-600 dark:text-orange-400 hover:underline">
                  Sửa tên
                </button>
              </div>
              <input 
                type="text" 
                id="dsProfileNameInput2" 
                value="${escapeHtml(pendingName)}" 
                placeholder="Nhập tên của bạn..." 
                maxlength="40"
                class="w-full h-9 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
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
                  class="text-[11px] text-zinc-500 hover:text-orange-600 dark:hover:text-orange-400 transition"
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
                      class="btn-avatar-preset flex flex-col items-center justify-center h-11 rounded-xl border text-xl transition cursor-pointer ${
                        isSelected 
                          ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30' 
                          : 'border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
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
                class="w-full h-10 px-3.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <i data-lucide="image-plus" class="w-4 h-4 text-orange-500"></i>
                <span>Tải ảnh đại diện từ thiết bị</span>
              </button>
            </div>

            <!-- Action Buttons for Step 2 -->
            <div class="flex items-center gap-2 pt-2">
              ${isOnboarding ? `
                <button 
                  type="button" 
                  id="dsProfileBackToStep1"
                  class="h-11 px-3.5 rounded-xl text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Quay lại
                </button>
                <button 
                  type="button" 
                  id="dsProfileSkipAvatarBtn"
                  class="flex-1 h-11 px-3 rounded-xl text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer text-center"
                >
                  Dùng chữ cái
                </button>
              ` : `
                <button 
                  type="button" 
                  id="dsProfileCancelEditBtn"
                  class="flex-1 h-11 px-4 rounded-xl text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Hủy
                </button>
              `}
              <button 
                type="button" 
                id="dsProfileSaveAllBtn"
                class="flex-[1.3] h-11 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-md shadow-orange-500/20 active:scale-[0.98] transition cursor-pointer inline-flex items-center justify-center gap-1.5"
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
    // Close button
    const closeBtn = modalOverlay.querySelector('#dsProfileCloseBtn');
    if (closeBtn) closeBtn.onclick = closeProfileModal;

    // Overlay click to close
    modalOverlay.onclick = (e) => {
      if (e.target === modalOverlay) closeProfileModal();
    };

    if (currentStep === 1) {
      const nameInput = modalOverlay.querySelector('#dsProfileNameInput');
      const errorP = modalOverlay.querySelector('#dsProfileNameError');
      const nextBtn = modalOverlay.querySelector('#dsProfileNextStepBtn');
      const skipBtn = modalOverlay.querySelector('#dsProfileSkipBtn');

      const handleNext = () => {
        const val = (nameInput?.value || '').trim();
        if (!val || val.length < 2) {
          if (errorP) {
            errorP.textContent = 'Vui lòng nhập tên có ít nhất 2 ký tự';
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
        skipBtn.onclick = () => {
          // Skip onboarding: set temporary guest flag and close
          closeProfileModal();
        };
      }
    } else {
      // Step 2 listeners
      const nameInput2 = modalOverlay.querySelector('#dsProfileNameInput2');
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
      const saveBtn = modalOverlay.querySelector('#dsProfileSaveAllBtn');
      const doSave = async () => {
        const finalName = (nameInput2?.value || pendingName || '').trim();
        if (!finalName) {
          showToast('Vui lòng nhập tên của bạn', 'error');
          nameInput2?.focus();
          return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span> Đang lưu...`;

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

      if (saveBtn) saveBtn.onclick = doSave;
    }
  }

  // Keydown listener for Escape
  const handleKeydown = (e) => {
    if (e.key === 'Escape') closeProfileModal();
  };
  document.addEventListener('keydown', handleKeydown);

  modalOverlay._cleanup = () => {
    document.removeEventListener('keydown', handleKeydown);
  };

  document.body.appendChild(modalOverlay);
  activeModalEl = modalOverlay;
  renderModalContent();
}

export function closeProfileModal() {
  if (activeModalEl) {
    if (typeof activeModalEl._cleanup === 'function') activeModalEl._cleanup();
    activeModalEl.remove();
    activeModalEl = null;
  }
}
