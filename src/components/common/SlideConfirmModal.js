/**
 * SlideConfirmModal Component (< 180 lines)
 * Reusable slide-to-confirm dialog for destructive, irreversible actions.
 */

let activeConfirmCallback = null;
let keydownListener = null;

/**
 * Returns static HTML markup for the slide confirm modal.
 * @param {string} [id] - Unique container DOM ID
 * @returns {string} HTML string
 */
export function renderSlideConfirmModal(id = 'globalSlideConfirmModal') {
  return `
    <div id="${id}" class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md hidden select-none" style="display: none; -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);">
      <div class="relative w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 sm:p-6 shadow-2xl space-y-4 animate-scaleUp">
        <!-- Header -->
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-500 dark:text-rose-400 shrink-0">
              <i data-lucide="trash-2" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0 flex-1">
              <h3 id="${id}Title" class="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">Dọn sạch thùng rác</h3>
              <p id="${id}Desc" class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 break-words line-clamp-2">Xóa vĩnh viễn toàn bộ tệp trong thùng rác.</p>
            </div>
          </div>
          <button type="button" id="${id}BtnClose" class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition cursor-pointer shrink-0" title="Đóng">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Warning Callout -->
        <div id="${id}Warning" class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2.5">
          <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0"></i>
          <span id="${id}WarningText" class="break-words">Hành động này không thể hoàn tác. Các tệp sẽ bị xóa hoàn toàn khỏi máy chủ.</span>
        </div>

        <!-- Slide to Confirm Track -->
        <div class="pt-1">
          <div id="${id}Track" class="relative h-12 w-full bg-zinc-100 dark:bg-[#08080a] border border-zinc-200 dark:border-zinc-800 rounded-full overflow-hidden select-none flex items-center justify-center shadow-inner" style="touch-action: none; user-select: none; -webkit-user-select: none;">
            <div id="${id}Progress" class="absolute left-0 top-0 bottom-0 bg-rose-500/20 dark:bg-rose-500/25 rounded-full pointer-events-none transition-none" style="width: 0px;"></div>
            <span id="${id}Text" class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 pointer-events-none select-none tracking-wide transition-opacity">
              Kéo sang phải để xác nhận
            </span>
            <div id="${id}Handle" class="absolute left-1 w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-md cursor-grab active:cursor-grabbing select-none transition-none" style="touch-action: none; user-select: none; -webkit-user-select: none;">
              <i data-lucide="chevrons-right" class="w-5 h-5 pointer-events-none select-none"></i>
            </div>
          </div>
        </div>

        <!-- Footer / Cancel button -->
        <div class="flex justify-end pt-1">
          <button type="button" id="${id}BtnCancel" class="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition cursor-pointer">
            Hủy
          </button>
        </div>
      </div>
    </div>
  `.trim();
}

/**
 * Ensures the modal element is attached to the DOM
 * @param {string} id
 * @returns {HTMLElement}
 */
function ensureModalMounted(id = 'globalSlideConfirmModal') {
  const existingModals = typeof document !== 'undefined' ? document.querySelectorAll(`[id="${id}"]`) : [];
  let modal = null;
  if (existingModals.length > 0) {
    modal = existingModals[0];
    for (let i = 1; i < existingModals.length; i++) {
      existingModals[i].remove();
    }
    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
  } else {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderSlideConfirmModal(id);
    modal = wrapper.firstElementChild;
    document.body.appendChild(modal);
  }
  return modal;
}

let activeDragCleanup = null;

/**
 * Opens the slide-to-confirm modal with drag-to-verify interaction
 * @param {Object|Function} optionsOrConfirm
 */
export function openSlideConfirmModal(optionsOrConfirm) {
  const options = typeof optionsOrConfirm === 'function'
    ? { onConfirm: optionsOrConfirm }
    : (optionsOrConfirm || {});

  const id = options.modalId || 'globalSlideConfirmModal';
  const modal = ensureModalMounted(id);
  const track = document.getElementById(`${id}Track`);
  const handle = document.getElementById(`${id}Handle`);
  const progress = document.getElementById(`${id}Progress`);
  const text = document.getElementById(`${id}Text`);
  const titleEl = document.getElementById(`${id}Title`);
  const descEl = document.getElementById(`${id}Desc`);
  const warningTextEl = document.getElementById(`${id}WarningText`);
  const btnClose = document.getElementById(`${id}BtnClose`);
  const btnCancel = document.getElementById(`${id}BtnCancel`);

  if (!modal || !track || !handle) return;

  // Guarantee modal is a direct child of document.body
  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }

  const title = options.title || 'Dọn sạch thùng rác';
  const description = options.description || 'Xóa vĩnh viễn toàn bộ tệp trong thùng rác.';
  const warningText = options.warningText || 'Hành động này không thể hoàn tác. Các tệp sẽ bị xóa hoàn toàn khỏi máy chủ.';
  const actionText = options.actionText || 'Kéo sang phải để xác nhận';
  const confirmingText = options.confirmingText || 'Đang dọn sạch...';

  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = description;
  if (warningTextEl) warningTextEl.textContent = warningText;

  activeConfirmCallback = options.onConfirm || null;
  modal.classList.remove('hidden');
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.display = 'flex';
  modal.style.zIndex = '99999';
  modal.style.backdropFilter = 'blur(12px)';
  modal.style.webkitBackdropFilter = 'blur(12px)';

  // Lock scrolling while confirm modal is active
  try {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  } catch {}

  if (window.lucide) window.lucide.createIcons();

  // Reset handle and track
  handle.style.transition = 'none';
  handle.style.transform = 'translateX(0px)';
  if (progress) {
    progress.style.transition = 'none';
    progress.style.width = '0px';
  }
  if (text) {
    text.style.opacity = '1';
    text.textContent = actionText;
  }

  let isDragging = false;
  let activePointerId = null;
  let startX = 0;
  let currentX = 0;

  const getMaxDrag = () => Math.max(10, track.clientWidth - handle.clientWidth - 8);

  const updateDrag = (clientX) => {
    if (!isDragging) return;
    const maxDrag = getMaxDrag();
    const delta = clientX - startX;
    currentX = Math.max(0, Math.min(delta, maxDrag));
    handle.style.transform = `translateX(${currentX}px)`;
    if (progress) progress.style.width = `${currentX + 24}px`;
    if (text) text.style.opacity = String(Math.max(0, 1 - (currentX / maxDrag) * 1.5));
  };

  const startDrag = (pointerId, clientX) => {
    isDragging = true;
    activePointerId = pointerId;
    startX = clientX;
    currentX = 0;
    handle.style.transition = 'none';
    if (progress) progress.style.transition = 'none';
  };

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    activePointerId = null;

    const maxDrag = getMaxDrag();
    if (currentX >= maxDrag * 0.75) {
      handle.style.transition = 'transform 0.15s ease-out';
      handle.style.transform = `translateX(${maxDrag}px)`;
      if (progress) {
        progress.style.transition = 'width 0.15s ease-out';
        progress.style.width = '100%';
      }
      if (text) {
        text.style.opacity = '1';
        text.textContent = confirmingText;
      }
      setTimeout(async () => {
        const callbackToExecute = activeConfirmCallback;
        closeSlideConfirmModal(id);
        if (typeof callbackToExecute === 'function') {
          try {
            await callbackToExecute();
          } catch (err) {
            console.error('Slide confirm callback failed:', err);
          }
        }
      }, 180);
    } else {
      handle.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';
      handle.style.transform = 'translateX(0px)';
      if (progress) {
        progress.style.transition = 'width 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';
        progress.style.width = '0px';
      }
      if (text) text.style.opacity = '1';
    }
  };

  handle.onpointerdown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {}
    startDrag(e.pointerId, e.clientX);
  };

  handle.onpointermove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    updateDrag(e.clientX);
  };

  const onPointerFinish = (e) => {
    if (!isDragging) return;
    try {
      handle.releasePointerCapture(e.pointerId);
    } catch {}
    endDrag();
  };

  handle.onpointerup = onPointerFinish;
  handle.onpointercancel = onPointerFinish;

  const onWindowPointerUp = (e) => {
    if (isDragging && (activePointerId === null || e.pointerId === activePointerId)) {
      endDrag();
    }
  };
  window.addEventListener('pointerup', onWindowPointerUp);
  window.addEventListener('pointercancel', onWindowPointerUp);

  activeDragCleanup = () => {
    window.removeEventListener('pointerup', onWindowPointerUp);
    window.removeEventListener('pointercancel', onWindowPointerUp);
    if (handle) {
      handle.onpointerdown = null;
      handle.onpointermove = null;
      handle.onpointerup = null;
      handle.onpointercancel = null;
    }
  };

  if (btnClose) btnClose.onclick = () => closeSlideConfirmModal(id);
  if (btnCancel) btnCancel.onclick = () => closeSlideConfirmModal(id);
  modal.onclick = (e) => { if (e.target === modal) closeSlideConfirmModal(id); };

  if (keydownListener) window.removeEventListener('keydown', keydownListener);
  keydownListener = (e) => { if (e.key === 'Escape') closeSlideConfirmModal(id); };
  window.addEventListener('keydown', keydownListener);
}

/**
 * Closes and resets the slide confirm modal
 * @param {string} [id]
 */
export function closeSlideConfirmModal(id = 'globalSlideConfirmModal') {
  if (typeof activeDragCleanup === 'function') {
    activeDragCleanup();
    activeDragCleanup = null;
  }
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }

  // Restore background scrolling
  try {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  } catch {}

  activeConfirmCallback = null;
  if (keydownListener) {
    window.removeEventListener('keydown', keydownListener);
    keydownListener = null;
  }
}
