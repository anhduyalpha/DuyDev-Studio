/**
 * InvalidUrlAlertModal Component (< 130 lines)
 * Prominent centered amber/orange warning modal ensuring the user understands
 * why a course / folder / page URL cannot be downloaded directly.
 * Teleports directly to document.body to guarantee 100% viewport coverage & true centering.
 */

const MODAL_ID = 'studocuInvalidUrlModal';

export function renderInvalidUrlAlertModal() {
  return `
    <div id="${MODAL_ID}" class="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/45 dark:bg-black/75 backdrop-blur-sm select-none" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);">
      <div class="relative w-full max-w-md rounded-2xl border border-amber-500/35 dark:border-amber-500/30 bg-white dark:bg-[#111114] p-5 sm:p-6 shadow-2xl shadow-amber-500/10 space-y-4 animate-scaleUp m-auto">
        
        <!-- Header with prominent Amber Icon -->
        <div class="flex items-start gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-inner">
            <i data-lucide="alert-triangle" class="w-6 h-6"></i>
          </div>
          <div class="min-w-0 flex-1 pt-0.5">
            <h3 id="${MODAL_ID}Title" class="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-snug">
              Liên kết môn học, không phải tài liệu
            </h3>
            <p id="${MODAL_ID}Subtitle" class="text-xs text-amber-600 dark:text-amber-400 font-medium mt-0.5">
              Cần chọn tệp tài liệu cụ thể để tải
            </p>
          </div>
          <button type="button" id="${MODAL_ID}BtnX" class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0" title="Đóng">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Detailed Explanatory Message -->
        <div class="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/[0.08] border border-amber-500/25 space-y-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">
          <p id="${MODAL_ID}Desc">
            Bạn vừa dán đường dẫn trang <strong>môn học / thư mục</strong> (chứa danh sách gồm nhiều tài liệu). Trang này không chứa nội dung trực tiếp để xuất PDF.
          </p>
          <div class="pt-1 pb-0.5 space-y-1.5 font-mono text-[11px] sm:text-xs">
            <div class="flex items-center gap-2 text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-rose-500/20">
              <span class="font-bold shrink-0">✕ Link môn:</span>
              <span class="truncate">studocu.com/.../<strong>course</strong>/...</span>
            </div>
            <div class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
              <span class="font-bold shrink-0">✓ Link file:</span>
              <span class="truncate">studocu.com/.../<strong>document</strong>/...</span>
            </div>
          </div>
          <p class="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400 pt-1">
            👉 <strong>Hướng dẫn:</strong> Bấm mở 1 tài liệu cụ thể trên Studocu, sau đó sao chép link trên thanh địa chỉ trình duyệt rồi dán lại vào đây.
          </p>
        </div>

        <!-- Action Button (Centered & Prominent) -->
        <div class="pt-1">
          <button
            type="button"
            id="${MODAL_ID}BtnOk"
            class="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.99] text-white font-semibold text-sm shadow-md shadow-amber-500/25 transition cursor-pointer select-none"
          >
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Đã hiểu (OK)</span>
          </button>
        </div>

      </div>
    </div>
  `.trim();
}

/**
 * Ensures modal is mounted as a direct child of document.body
 * This eliminates containing block restrictions from parent CSS transforms/animations.
 */
function ensureModalMounted() {
  if (typeof document === 'undefined') return null;
  let modal = document.getElementById(MODAL_ID);
  if (!modal) {
    const temp = document.createElement('div');
    temp.innerHTML = renderInvalidUrlAlertModal();
    modal = temp.firstElementChild;
    document.body.appendChild(modal);
  } else if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  return modal;
}

export function openInvalidUrlAlertModal(options = {}) {
  const modal = ensureModalMounted();
  if (!modal) return;

  const titleEl = document.getElementById(`${MODAL_ID}Title`);
  const subtitleEl = document.getElementById(`${MODAL_ID}Subtitle`);
  const descEl = document.getElementById(`${MODAL_ID}Desc`);

  if (options.title && titleEl) titleEl.textContent = options.title;
  if (options.subtitle && subtitleEl) subtitleEl.textContent = options.subtitle;
  if (options.message && descEl) descEl.innerHTML = options.message;

  modal.style.display = 'flex';
  modal.classList.remove('hidden');

  if (window.lucide?.createIcons) window.lucide.createIcons();

  const closeFn = () => {
    closeInvalidUrlAlertModal();
    const input = document.getElementById('studocuUrlInput');
    if (input) {
      input.focus();
      input.select();
    }
  };

  const btnOk = document.getElementById(`${MODAL_ID}BtnOk`);
  const btnX = document.getElementById(`${MODAL_ID}BtnX`);

  if (btnOk) btnOk.onclick = closeFn;
  if (btnX) btnX.onclick = closeFn;

  modal.onclick = (e) => {
    if (e.target === modal) closeFn();
  };

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeFn();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

export function closeInvalidUrlAlertModal() {
  const modal = document.getElementById(MODAL_ID);
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
}
