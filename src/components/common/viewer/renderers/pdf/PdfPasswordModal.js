/**
 * PdfPasswordModal Component (< 140 lines)
 * Glassmorphic Password Prompt for Encrypted PDF Documents
 */

let activeModalState = null;

export function renderPasswordModal() {
  return `
    <div id="pdfPasswordModalBackdrop" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity duration-200 opacity-0 pointer-events-none select-none">
      <div id="pdfPasswordModalCard" class="w-full max-w-sm rounded-2xl bg-white/95 dark:bg-[#121216]/95 backdrop-blur-md border border-zinc-200 dark:border-white/10 shadow-2xl p-6 transition-all duration-200 scale-95">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <i data-lucide="lock" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Tài liệu được bảo vệ</h3>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">Vui lòng nhập mật khẩu để mở tệp PDF này</p>
          </div>
        </div>

        <form id="pdfPasswordForm" class="space-y-4" onsubmit="return false;">
          <div class="relative">
            <input id="inputPdfPassword" type="password" placeholder="Nhập mật khẩu PDF..." autocomplete="current-password"
              class="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-sans transition" />
            <button id="btnTogglePasswordVisibility" type="button" title="Hiện mật khẩu"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition cursor-pointer">
              <i data-lucide="eye" class="w-4 h-4"></i>
            </button>
          </div>

          <p id="pdfPasswordErrorMsg" class="text-xs text-rose-500 font-medium hidden"></p>

          <div class="flex items-center justify-end gap-2 pt-1">
            <button id="btnCancelPdfPassword" type="button"
              class="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 transition cursor-pointer">
              Hủy
            </button>
            <button id="btnSubmitPdfPassword" type="submit"
              class="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer">
              Mở tài liệu
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function promptPdfPassword(isIncorrect = false) {
  return new Promise((resolve) => {
    const backdrop = document.getElementById('pdfPasswordModalBackdrop');
    const card = document.getElementById('pdfPasswordModalCard');
    const input = document.getElementById('inputPdfPassword');
    const errorMsg = document.getElementById('pdfPasswordErrorMsg');
    const form = document.getElementById('pdfPasswordForm');
    const btnCancel = document.getElementById('btnCancelPdfPassword');
    const btnToggle = document.getElementById('btnTogglePasswordVisibility');

    if (!backdrop || !input) {
      resolve(null);
      return;
    }

    // Reset error state
    if (isIncorrect && errorMsg) {
      errorMsg.textContent = 'Mật khẩu không chính xác. Vui lòng thử lại.';
      errorMsg.classList.remove('hidden');
    } else if (errorMsg) {
      errorMsg.classList.add('hidden');
    }

    input.value = '';
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    backdrop.classList.add('opacity-100', 'pointer-events-auto');
    if (card) {
      card.classList.remove('scale-95');
      card.classList.add('scale-100');
    }

    if (window.lucide) window.lucide.createIcons({ root: backdrop });

    setTimeout(() => input.focus(), 100);

    const cleanup = () => {
      backdrop.classList.remove('opacity-100', 'pointer-events-auto');
      backdrop.classList.add('opacity-0', 'pointer-events-none');
      if (card) {
        card.classList.remove('scale-100');
        card.classList.add('scale-95');
      }
      form?.removeEventListener('submit', handleSubmit);
      btnCancel?.removeEventListener('click', handleCancel);
      btnToggle?.removeEventListener('click', handleToggle);
      window.removeEventListener('keydown', handleKeydown);
      activeModalState = null;
    };

    const handleSubmit = (e) => {
      e?.preventDefault();
      const val = input.value;
      cleanup();
      resolve(val);
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    const handleToggle = () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btnToggle.innerHTML = `<i data-lucide="${isPassword ? 'eye-off' : 'eye'}" class="w-4 h-4"></i>`;
      if (window.lucide) window.lucide.createIcons({ root: btnToggle });
    };

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    form?.addEventListener('submit', handleSubmit);
    btnCancel?.addEventListener('click', handleCancel);
    btnToggle?.addEventListener('click', handleToggle);
    window.addEventListener('keydown', handleKeydown);

    activeModalState = { cleanup };
  });
}

export function closePasswordModal() {
  if (activeModalState) {
    activeModalState.cleanup();
  }
}
