/**
 * adminAuth.js - Admin Authentication & Access Guard
 * Protects critical settings, state wipe, and destructive operations.
 */

import { showToast } from './toast.js';

const STORAGE_KEY_PWD_HASH = 'ds_admin_pwd_hash';
const SESSION_KEY_AUTH = 'ds_admin_authenticated';
const SESSION_KEY_TOKEN = 'ds_admin_token';

// SHA-256 for default password: "anhduy123"
const DEFAULT_HASH_ANHDUY = 'a40c326dd366739719ecbb8380f0534093cf6916b9b63114a71e885d20692ccc';
// SHA-256 for legacy fallback passwords: "duydev", "admin"
const DEFAULT_HASH_DUYDEV = '3bc00dd78427db6937b4606a8e593ec3560c4343665d9fba311b103612baf8fb';
const DEFAULT_HASH_ADMIN = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';

/**
 * Computes SHA-256 hex string using browser native SubtleCrypto
 */
export async function sha256(str) {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const enc = new TextEncoder().encode(str);
    const buf = await window.crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Simple deterministic fallback if crypto.subtle is unavailable
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

/**
 * Checks if the current browser session has active admin authorization
 */
export function isAdminAuthenticated() {
  try {
    if (sessionStorage.getItem(SESSION_KEY_AUTH) === 'true') {
      return true;
    }
    const storedToken = localStorage.getItem(SESSION_KEY_TOKEN);
    if (storedToken && storedToken.includes('.')) {
      const exp = parseInt(storedToken.split('.')[0], 10);
      if (!isNaN(exp) && exp > Date.now()) {
        sessionStorage.setItem(SESSION_KEY_AUTH, 'true');
        sessionStorage.setItem(SESSION_KEY_TOKEN, storedToken);
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Gets session auth token for API calls
 */
export function getAdminToken() {
  try {
    const sessionToken = sessionStorage.getItem(SESSION_KEY_TOKEN);
    if (sessionToken) return sessionToken;
    const localToken = localStorage.getItem(SESSION_KEY_TOKEN);
    if (localToken && localToken.includes('.')) {
      const exp = parseInt(localToken.split('.')[0], 10);
      if (!isNaN(exp) && exp > Date.now()) {
        sessionStorage.setItem(SESSION_KEY_TOKEN, localToken);
        return localToken;
      }
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Returns header object with auth credentials
 */
export function getStorageAuthHeaders() {
  const token = getAdminToken();
  const headers = {};
  if (token) {
    headers['x-storage-auth'] = token;
  }
  return headers;
}

/**
 * Validates the admin password (tries server first for cross-machine sync, falls back to local)
 */
export async function verifyAdminPassword(password) {
  if (!password || typeof password !== 'string') return false;
  const trimmed = password.trim();
  const inputHash = await sha256(trimmed);

  // 1. Try server online verification first
  try {
    const res = await fetch('/api/v1/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: trimmed })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data?.token) {
        try {
          sessionStorage.setItem(SESSION_KEY_AUTH, 'true');
          sessionStorage.setItem(SESSION_KEY_TOKEN, data.data.token);
          localStorage.setItem(SESSION_KEY_TOKEN, data.data.token);
          localStorage.setItem(STORAGE_KEY_PWD_HASH, inputHash);
        } catch {}
        return true;
      }
    } else if (res.status === 401) {
      return false;
    }
  } catch (netErr) {
    // Network error / offline mode, proceed with local check
  }

  // 2. Fallback to local storage hash or defaults
  const storedHash = localStorage.getItem(STORAGE_KEY_PWD_HASH);
  let isValid = false;
  if (inputHash === DEFAULT_HASH_ANHDUY) {
    isValid = true;
    try {
      localStorage.setItem(STORAGE_KEY_PWD_HASH, DEFAULT_HASH_ANHDUY);
    } catch {}
  } else if (storedHash) {
    isValid = (inputHash === storedHash);
  } else {
    isValid = (inputHash === DEFAULT_HASH_DUYDEV || inputHash === DEFAULT_HASH_ADMIN);
  }

  if (isValid) {
    try {
      sessionStorage.setItem(SESSION_KEY_AUTH, 'true');
    } catch {}
  }
  return isValid;
}

/**
 * Sets a new admin password after verifying the old password
 */
export async function changeAdminPassword(oldPassword, newPassword) {
  if (!newPassword || newPassword.trim().length < 4) {
    return { success: false, error: 'Mật khẩu mới phải có tối thiểu 4 ký tự' };
  }

  // 1. Try server online change first
  try {
    const res = await fetch('/api/v1/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.message || 'Mật khẩu hiện tại không chính xác' };
    }
    if (data.data?.token) {
      try {
        sessionStorage.setItem(SESSION_KEY_TOKEN, data.data.token);
      } catch {}
    }
  } catch (netErr) {
    // If server unreachable, check local
    const isOldValid = await verifyAdminPassword(oldPassword);
    if (!isOldValid) {
      return { success: false, error: 'Mật khẩu hiện tại không chính xác' };
    }
  }

  const newHash = await sha256(newPassword.trim());
  try {
    localStorage.setItem(STORAGE_KEY_PWD_HASH, newHash);
    sessionStorage.setItem(SESSION_KEY_AUTH, 'true');
  } catch {}
  return { success: true };
}

/**
 * Locks the admin session
 */
export function lockAdminSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY_AUTH);
    sessionStorage.removeItem(SESSION_KEY_TOKEN);
    localStorage.removeItem(SESSION_KEY_TOKEN);
  } catch {}
}


/**
 * Intercepts an action: executes immediately if admin is authenticated,
 * otherwise prompts the user with an Admin Password Modal.
 */
export function requireAdmin(onAuthorized, message = 'Yêu cầu mật khẩu Quản trị viên để thực hiện thao tác này.') {
  if (isAdminAuthenticated()) {
    onAuthorized();
    return;
  }
  showAdminPasswordModal({
    message,
    onSuccess: () => {
      onAuthorized();
    }
  });
}

/**
 * Displays the modal for entering the Admin Password
 */
export function showAdminPasswordModal({ message = 'Nhập mật khẩu Quản trị viên để xác thực.', onSuccess, onCancel } = {}) {
  const modalContainerId = 'ds-admin-password-modal-root';
  let modalEl = document.getElementById(modalContainerId);
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = modalContainerId;
    document.body.appendChild(modalEl);
  }

  modalEl.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div class="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <i data-lucide="shield-alert" class="w-5 h-5"></i>
          </div>
          <div>
            <h4 class="font-bold text-sm text-zinc-900 dark:text-white">Xác thực Quản trị viên</h4>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">${message}</p>
          </div>
        </div>

        <div class="space-y-2">
          <input 
            type="password" 
            id="dsModalAdminPwdInput" 
            placeholder="Mật khẩu quản trị..." 
            autocomplete="current-password"
            class="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-indigo-500 font-sans"
          />
          <p id="dsModalAdminPwdError" class="text-[11px] text-red-500 font-medium hidden">Mật khẩu không chính xác</p>
        </div>

        <div class="flex items-center justify-end gap-2 pt-1">
          <button id="dsBtnCancelAdminPwd" class="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer">
            Hủy
          </button>
          <button id="dsBtnSubmitAdminPwd" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-xs cursor-pointer flex items-center gap-1.5">
            <i data-lucide="key" class="w-3.5 h-3.5"></i> Mở khóa
          </button>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const cleanup = () => {
    modalEl.innerHTML = '';
  };

  const input = document.getElementById('dsModalAdminPwdInput');
  const errorEl = document.getElementById('dsModalAdminPwdError');
  const btnSubmit = document.getElementById('dsBtnSubmitAdminPwd');
  const btnCancel = document.getElementById('dsBtnCancelAdminPwd');

  if (input) input.focus();

  const handleVerify = async () => {
    const val = input.value;
    const ok = await verifyAdminPassword(val);
    if (ok) {
      cleanup();
      showToast('Đã xác thực Quản trị viên', 'success');
      if (typeof onSuccess === 'function') onSuccess();
    } else {
      if (errorEl) errorEl.classList.remove('hidden');
      if (input) {
        input.classList.add('border-red-500');
        input.focus();
        input.select();
      }
    }
  };

  if (btnSubmit) btnSubmit.onclick = handleVerify;
  if (input) {
    input.onkeydown = (e) => {
      if (e.key === 'Enter') handleVerify();
      if (e.key === 'Escape') {
        cleanup();
        if (typeof onCancel === 'function') onCancel();
      }
    };
  }
  if (btnCancel) {
    btnCancel.onclick = () => {
      cleanup();
      if (typeof onCancel === 'function') onCancel();
    };
  }
}

/**
 * Displays the modal for changing the admin password
 */
export function showChangePasswordModal(onUpdated) {
  const modalContainerId = 'ds-admin-password-modal-root';
  let modalEl = document.getElementById(modalContainerId);
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = modalContainerId;
    document.body.appendChild(modalEl);
  }

  modalEl.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div class="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <i data-lucide="key" class="w-5 h-5"></i>
          </div>
          <div>
            <h4 class="font-bold text-sm text-zinc-900 dark:text-white">Đổi mật khẩu Quản trị</h4>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Đặt mật khẩu mới cho khu vực quản trị.</p>
          </div>
        </div>

        <div class="space-y-2.5">
          <div>
            <label class="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Mật khẩu hiện tại</label>
            <input type="password" id="dsInputOldPwd" placeholder="Mật khẩu cũ..." class="w-full px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-indigo-500 font-sans" />
          </div>
          <div>
            <label class="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Mật khẩu mới</label>
            <input type="password" id="dsInputNewPwd" placeholder="Tối thiểu 4 ký tự..." class="w-full px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-indigo-500 font-sans" />
          </div>
          <p id="dsChangePwdError" class="text-[11px] text-red-500 font-medium hidden"></p>
        </div>

        <div class="flex items-center justify-end gap-2 pt-1">
          <button id="dsBtnCancelChangePwd" class="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer">Hủy</button>
          <button id="dsBtnSaveChangePwd" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-xs cursor-pointer">Lưu mật khẩu</button>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const cleanup = () => { modalEl.innerHTML = ''; };
  const oldInput = document.getElementById('dsInputOldPwd');
  const newInput = document.getElementById('dsInputNewPwd');
  const errorEl = document.getElementById('dsChangePwdError');
  const btnSave = document.getElementById('dsBtnSaveChangePwd');
  const btnCancel = document.getElementById('dsBtnCancelChangePwd');

  if (oldInput) oldInput.focus();

  const handleSave = async () => {
    const oldVal = oldInput.value;
    const newVal = newInput.value;
    const res = await changeAdminPassword(oldVal, newVal);
    if (res.success) {
      cleanup();
      showToast('Đã đổi mật khẩu quản trị thành công', 'success');
      if (typeof onUpdated === 'function') onUpdated();
    } else {
      if (errorEl) {
        errorEl.textContent = res.error;
        errorEl.classList.remove('hidden');
      }
    }
  };

  if (btnSave) btnSave.onclick = handleSave;
  if (btnCancel) btnCancel.onclick = cleanup;
  if (newInput) {
    newInput.onkeydown = (e) => {
      if (e.key === 'Enter') handleSave();
      if (e.key === 'Escape') cleanup();
    };
  }
}
