/**
 * AdminUsersManager.js - User Accounts Management Component
 * Allows admin to create, edit, delete, assign roles, set custom rate limits, and regenerate API keys for registered users.
 */

import { getStorageAuthHeaders } from '../../utilities/adminAuth.js';
import { showToast } from '../../utilities/toast.js';

let cachedUsers = [];
let userSearchQuery = '';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoStr) {
  if (!isoStr) return '--';
  return new Date(isoStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Renders the User Accounts Manager component markup
 */
export function renderUsersManager() {
  return `
    <div id="adminUsersManagerContainer" class="space-y-5 animate-fadeIn">
      <!-- Header Action Bar -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-white/5">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
            <i data-lucide="user-check" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Danh Sách Tài Khoản Người Dùng
              <span id="adminUsersCountBadge" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                0 users
              </span>
            </h3>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">
              Quản trị tài khoản, phân quyền quản trị, mật khẩu và giới hạn tần suất yêu cầu (Rate Limit)
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            id="btnRefreshUsersList"
            class="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold border border-zinc-200 dark:border-white/5 transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            title="Làm mới danh sách"
          >
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Làm Mới</span>
          </button>

          <button
            type="button"
            id="btnOpenCreateUserModal"
            class="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-orange-500/20 active:scale-95"
          >
            <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
            <span>+ Thêm Người Dùng</span>
          </button>
        </div>
      </div>

      <!-- Search Input -->
      <div class="relative w-full sm:w-80">
        <input
          type="text"
          id="inputSearchUsers"
          placeholder="Tìm theo tên đăng nhập hoặc ghi chú..."
          value="${escapeHtml(userSearchQuery)}"
          class="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 font-mono shadow-xs"
        />
        <i data-lucide="search" class="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
      </div>

      <!-- Users Table -->
      <div class="rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 backdrop-blur-xl shadow-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-zinc-50 dark:bg-zinc-950/60 text-zinc-500 dark:text-zinc-400 font-mono text-[11px] border-b border-zinc-200 dark:border-white/5">
              <tr>
                <th class="px-4 py-3">Người Dùng</th>
                <th class="px-4 py-3">Vai Trò</th>
                <th class="px-4 py-3">Trạng Thái</th>
                <th class="px-4 py-3 text-center">Rate Limit (RPM)</th>
                <th class="px-4 py-3">API Key</th>
                <th class="px-4 py-3 text-right">Tổng Jobs</th>
                <th class="px-4 py-3">Ngày Tạo</th>
                <th class="px-4 py-3 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody id="adminUsersTableBody" class="divide-y divide-zinc-100 dark:divide-white/5 text-zinc-800 dark:text-zinc-200 font-mono">
              <tr>
                <td colspan="8" class="px-4 py-16 text-center text-zinc-500 font-sans">
                  <span class="inline-block animate-spin mr-2">⟳</span> Đang nạp danh sách tài khoản...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders table rows for users
 */
function renderUserRows(users) {
  if (!users || users.length === 0) {
    return `
      <tr>
        <td colspan="8" class="px-4 py-12 text-center text-zinc-500 font-sans">
          <div class="max-w-xs mx-auto space-y-1">
            <p class="font-bold text-zinc-400">Chưa có người dùng nào được tạo</p>
            <p class="text-xs text-zinc-500">Bấm nút "+ Thêm Người Dùng" ở góc trên để tạo tài khoản mới.</p>
          </div>
        </td>
      </tr>
    `;
  }

  return users.map(u => {
    const isAdmin = u.role === 'admin';
    const isBlocked = u.status === 'blocked';

    const roleBadge = isAdmin
      ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1 w-fit"><i data-lucide="shield-check" class="w-3 h-3"></i> Admin</span>`
      : `<span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/5 w-fit">User</span>`;

    const statusBadge = isBlocked
      ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center gap-1 w-fit"><i data-lucide="lock" class="w-3 h-3"></i> Bị Khóa</span>`
      : `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1 w-fit"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Hoạt Động</span>`;

    const rateLimitBadge = u.rateLimitRpm > 0
      ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">${u.rateLimitRpm} req/phút</span>`
      : `<span class="text-zinc-500 text-[11px]">Không giới hạn</span>`;

    const apiKeyDisplay = u.hasApiKey
      ? `
        <div class="flex items-center gap-1 text-[11px]">
          <span class="text-zinc-300 font-mono select-all">${escapeHtml(u.apiKeyPreview)}</span>
          <button
            type="button"
            class="btn-reset-user-key text-zinc-400 hover:text-orange-400 p-1 rounded-md transition cursor-pointer"
            data-user-id="${escapeHtml(u.id)}"
            data-username="${escapeHtml(u.username)}"
            title="Cấp lại API Key mới"
          >
            <i data-lucide="key-round" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `
      : `<span class="text-zinc-500 text-[11px]">Chưa tạo</span>`;

    return `
      <tr class="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition">
        <td class="px-4 py-3">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 font-bold text-xs uppercase shrink-0">
              ${escapeHtml(u.username.slice(0, 2))}
            </div>
            <div>
              <span class="font-bold text-zinc-900 dark:text-zinc-100 block">${escapeHtml(u.username)}</span>
              ${u.notes ? `<span class="text-[10px] text-zinc-400 font-sans block truncate max-w-[180px]">${escapeHtml(u.notes)}</span>` : ''}
            </div>
          </div>
        </td>

        <td class="px-4 py-3">
          ${roleBadge}
        </td>

        <td class="px-4 py-3">
          ${statusBadge}
        </td>

        <td class="px-4 py-3 text-center">
          ${rateLimitBadge}
        </td>

        <td class="px-4 py-3">
          ${apiKeyDisplay}
        </td>

        <td class="px-4 py-3 text-right">
          <strong class="text-zinc-900 dark:text-zinc-100 font-bold">${u.totalJobs || 0}</strong>
        </td>

        <td class="px-4 py-3 text-zinc-500 text-[11px]">
          ${formatDate(u.createdAt)}
        </td>

        <td class="px-4 py-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button
              type="button"
              class="btn-edit-user px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer active:scale-95 flex items-center gap-1"
              data-user-json='${escapeHtml(JSON.stringify(u))}'
              title="Sửa thông tin hoặc đổi mật khẩu"
            >
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              <span>Sửa</span>
            </button>

            <button
              type="button"
              class="btn-delete-user px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 text-xs font-semibold transition cursor-pointer active:scale-95 flex items-center gap-1"
              data-user-id="${escapeHtml(u.id)}"
              data-username="${escapeHtml(u.username)}"
              title="Xóa tài khoản này"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Fetches users from server and updates the table
 */
export async function fetchAndRenderUsers() {
  const tbody = document.getElementById('adminUsersTableBody');
  const countBadge = document.getElementById('adminUsersCountBadge');

  try {
    const res = await fetch('/api/v1/admin/users', {
      headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Không thể nạp danh sách người dùng');

    cachedUsers = json.data || [];
    if (countBadge) {
      countBadge.textContent = `${cachedUsers.length} users`;
    }

    const filtered = filterUsers(cachedUsers, userSearchQuery);
    if (tbody) {
      tbody.innerHTML = renderUserRows(filtered);
      if (window.lucide) window.lucide.createIcons();
    }
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="px-4 py-8 text-center text-rose-500 font-sans text-xs">
            Lỗi nạp danh sách: ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
    }
  }
}

function filterUsers(users, query) {
  if (!query) return users;
  const q = query.toLowerCase().trim();
  return users.filter(u =>
    (u.username && u.username.toLowerCase().includes(q)) ||
    (u.notes && u.notes.toLowerCase().includes(q)) ||
    (u.role && u.role.toLowerCase().includes(q))
  );
}

/**
 * Opens modal to create a new user account
 */
function openCreateUserModal(onSuccess) {
  const modalId = 'modalCreateUserAccount';
  const oldModal = document.getElementById(modalId);
  if (oldModal) oldModal.remove();

  const html = `
    <div id="${modalId}" class="fixed inset-0 z-[9998] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div class="relative w-full max-w-md rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#111114] p-5 sm:p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
              <i data-lucide="user-plus" class="w-4 h-4"></i>
            </div>
            <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">Tạo Tài Khoản Người Dùng Mới</h3>
          </div>
          <button type="button" id="btnCloseCreateUserModal" class="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-xl cursor-pointer">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <form id="formCreateUserAccount" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tên đăng nhập (Username) *</label>
            <input
              type="text"
              name="username"
              required
              minlength="3"
              placeholder="ví dụ: anhduy, nv_kythuat"
              class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Mật khẩu ban đầu *</label>
            <input
              type="password"
              name="password"
              required
              minlength="4"
              placeholder="Tối thiểu 4 ký tự"
              class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-orange-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Vai trò</label>
              <select
                name="role"
                class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
              >
                <option value="user">User (Người dùng thường)</option>
                <option value="admin">Admin (Quản trị viên)</option>
              </select>
            </div>

            <div>
              <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Rate Limit (RPM)</label>
              <input
                type="number"
                name="rateLimitRpm"
                min="0"
                max="10000"
                value="0"
                placeholder="0 = Không giới hạn"
                class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Ghi chú / Nhãn</label>
            <input
              type="text"
              name="notes"
              placeholder="ví dụ: Máy phòng thí nghiệm, Bạn thân..."
              class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div class="flex items-center gap-2 pt-1">
            <input type="checkbox" id="chkGenApiKey" name="generateApiKey" class="rounded text-orange-500 focus:ring-orange-500 cursor-pointer" />
            <label for="chkGenApiKey" class="text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">Tự động sinh API Key cho tài khoản này</label>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-white/5">
            <button
              type="button"
              id="btnCancelCreateUser"
              class="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              id="btnSubmitCreateUser"
              class="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold cursor-pointer transition shadow-md shadow-orange-500/20"
            >
              Tạo Người Dùng
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
  modalEl.querySelector('#btnCloseCreateUserModal').onclick = close;
  modalEl.querySelector('#btnCancelCreateUser').onclick = close;

  const form = modalEl.querySelector('#formCreateUserAccount');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = modalEl.querySelector('#btnSubmitCreateUser');
    btn.disabled = true;
    btn.textContent = 'Đang tạo...';

    const formData = new FormData(form);
    const payload = {
      username: formData.get('username'),
      password: formData.get('password'),
      role: formData.get('role'),
      rateLimitRpm: parseInt(formData.get('rateLimitRpm') || '0', 10),
      notes: formData.get('notes'),
      generateApiKey: formData.get('generateApiKey') === 'on'
    };

    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: {
          ...getStorageAuthHeaders(),
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Tạo người dùng thất bại');

      showToast(json.message || 'Đã tạo tài khoản thành công', 'success');
      close();
      if (onSuccess) onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Tạo Người Dùng';
    }
  };
}

/**
 * Opens modal to edit an existing user account
 */
function openEditUserModal(user, onSuccess) {
  const modalId = 'modalEditUserAccount';
  const oldModal = document.getElementById(modalId);
  if (oldModal) oldModal.remove();

  const html = `
    <div id="${modalId}" class="fixed inset-0 z-[9998] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div class="relative w-full max-w-md rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#111114] p-5 sm:p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">Sửa Tài Khoản: <span class="font-mono text-orange-400">${escapeHtml(user.username)}</span></h3>
            </div>
          </div>
          <button type="button" id="btnCloseEditUserModal" class="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-xl cursor-pointer">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <form id="formEditUserAccount" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tên đăng nhập</label>
            <input
              type="text"
              name="username"
              value="${escapeHtml(user.username)}"
              required
              minlength="3"
              class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Mật khẩu mới (để trống nếu không đổi)</label>
            <input
              type="password"
              name="password"
              placeholder="Nhập mật khẩu mới nếu muốn đổi..."
              class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-orange-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Vai trò</label>
              <select
                name="role"
                class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
              >
                <option value="user" ${user.role === 'user' ? 'selected' : ''}>User (Thường)</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin (Quản trị)</option>
              </select>
            </div>

            <div>
              <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Trạng thái</label>
              <select
                name="status"
                class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
              >
                <option value="active" ${user.status === 'active' ? 'selected' : ''}>Hoạt động</option>
                <option value="blocked" ${user.status === 'blocked' ? 'selected' : ''}>Khóa tài khoản</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Rate Limit (RPM)</label>
            <input
              type="number"
              name="rateLimitRpm"
              min="0"
              max="10000"
              value="${user.rateLimitRpm || 0}"
              placeholder="0 = Không giới hạn"
              class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label class="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Ghi chú / Nhãn</label>
            <input
              type="text"
              name="notes"
              value="${escapeHtml(user.notes || '')}"
              placeholder="Ghi chú về người dùng này..."
              class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-white/5">
            <button
              type="button"
              id="btnCancelEditUser"
              class="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              id="btnSubmitEditUser"
              class="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold cursor-pointer transition shadow-md shadow-orange-500/20"
            >
              Lưu Thay Đổi
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
  modalEl.querySelector('#btnCloseEditUserModal').onclick = close;
  modalEl.querySelector('#btnCancelEditUser').onclick = close;

  const form = modalEl.querySelector('#formEditUserAccount');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = modalEl.querySelector('#btnSubmitEditUser');
    btn.disabled = true;
    btn.textContent = 'Đang lưu...';

    const formData = new FormData(form);
    const pwd = formData.get('password');
    const payload = {
      username: formData.get('username'),
      role: formData.get('role'),
      status: formData.get('status'),
      rateLimitRpm: parseInt(formData.get('rateLimitRpm') || '0', 10),
      notes: formData.get('notes')
    };
    if (pwd && String(pwd).trim()) {
      payload.password = String(pwd).trim();
    }

    try {
      const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'PUT',
        headers: {
          ...getStorageAuthHeaders(),
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Cập nhật tài khoản thất bại');

      showToast(json.message || 'Đã cập nhật thông tin tài khoản', 'success');
      close();
      if (onSuccess) onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Lưu Thay Đổi';
    }
  };
}

/**
 * Attaches DOM event listeners for the Users Manager component
 */
export function attachUsersManagerListeners(onRerender) {
  // Initial load
  fetchAndRenderUsers();

  // Refresh button
  const btnRefresh = document.getElementById('btnRefreshUsersList');
  if (btnRefresh) {
    btnRefresh.onclick = () => fetchAndRenderUsers();
  }

  // Create User button
  const btnOpenCreate = document.getElementById('btnOpenCreateUserModal');
  if (btnOpenCreate) {
    btnOpenCreate.onclick = () => openCreateUserModal(() => fetchAndRenderUsers());
  }

  // Search input
  const inputSearch = document.getElementById('inputSearchUsers');
  if (inputSearch) {
    inputSearch.oninput = (e) => {
      userSearchQuery = e.target.value;
      const tbody = document.getElementById('adminUsersTableBody');
      if (tbody) {
        tbody.innerHTML = renderUserRows(filterUsers(cachedUsers, userSearchQuery));
        if (window.lucide) window.lucide.createIcons();
      }
    };
  }

  // Delegated table row actions (Edit, Delete, Reset API Key)
  const tbody = document.getElementById('adminUsersTableBody');
  if (tbody) {
    tbody.onclick = async (e) => {
      const editBtn = e.target.closest('.btn-edit-user');
      if (editBtn) {
        try {
          const userJson = JSON.parse(editBtn.dataset.userJson);
          openEditUserModal(userJson, () => fetchAndRenderUsers());
        } catch (err) {
          showToast('Không thể đọc dữ liệu người dùng', 'error');
        }
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-user');
      if (deleteBtn) {
        const userId = deleteBtn.dataset.userId;
        const username = deleteBtn.dataset.username;
        if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản người dùng '${username}'? Mọi tác vụ của người dùng này sẽ không thể khôi phục.`)) {
          return;
        }

        try {
          const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(userId)}`, {
            method: 'DELETE',
            headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.message || 'Xóa tài khoản thất bại');
          showToast(json.message || `Đã xóa tài khoản '${username}'`, 'success');
          fetchAndRenderUsers();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const resetKeyBtn = e.target.closest('.btn-reset-user-key');
      if (resetKeyBtn) {
        const userId = resetKeyBtn.dataset.userId;
        const username = resetKeyBtn.dataset.username;
        if (!confirm(`Cấp lại API Key mới cho người dùng '${username}'? Key cũ sẽ bị vô hiệu hóa ngay lập tức.`)) {
          return;
        }

        try {
          const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/reset-api-key`, {
            method: 'POST',
            headers: { ...getStorageAuthHeaders(), Accept: 'application/json' }
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.message || 'Cấp lại API Key thất bại');
          showToast(`API Key mới: ${json.data.apiKey}`, 'success', 8000);
          fetchAndRenderUsers();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    };
  }
}
