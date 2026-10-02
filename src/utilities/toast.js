/**
 * Toast Notification Utility (< 230 lines)
 * Provides sleek, accessible, deduplicated, and rate-limited toasts with FIFO eviction.
 * Completely prevents screen overflow and UI blocking when rapid actions are performed.
 */

const MAX_ACTIVE_TOASTS = 3;
const DEFAULT_DURATION = 2500;

/** @type {Array<{ id: string, message: string, type: string, element: HTMLElement, textSpan: HTMLElement | null, count: number, timeoutId: any, dismiss: (fast?: boolean) => void }>} */
const activeToasts = [];

/**
 * Returns the toast container element, creating it if necessary.
 * @returns {HTMLElement | null}
 */
function getToastContainer() {
  if (typeof document === 'undefined') return null;
  let container = document.getElementById('ds-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'ds-toast-container';
    container.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4 sm:px-0 max-h-[min(50vh,320px)] overflow-hidden';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Resolves icon and Tailwind styles for a given toast type.
 * @param {'info' | 'success' | 'error' | 'warning'} type
 * @returns {{ icon: string, styles: string }}
 */
function getToastStyling(type) {
  let icon = 'info';
  let styles = 'bg-zinc-900/95 text-white border-white/10 dark:bg-zinc-900/95 dark:text-white dark:border-white/15';

  if (type === 'success') {
    icon = 'check-circle-2';
    styles = 'bg-emerald-950/95 text-emerald-100 border-emerald-500/30';
  } else if (type === 'error') {
    icon = 'alert-circle';
    styles = 'bg-red-950/95 text-red-100 border-red-500/30';
  } else if (type === 'warning') {
    icon = 'alert-triangle';
    styles = 'bg-amber-950/95 text-amber-100 border-amber-500/30';
  }

  return { icon, styles };
}

/**
 * Retires oldest toasts when container reaches maximum capacity (FIFO).
 */
function evictOldestIfFull() {
  while (activeToasts.length >= MAX_ACTIVE_TOASTS) {
    const oldest = activeToasts[0];
    if (oldest) oldest.dismiss(true);
    else break;
  }
}

/**
 * Creates and registers a unified toast record with non-blocking exit transitions.
 */
function createToastRecord(toast, cleanMessage, type, textSpan = null) {
  /** @type {any} */
  const record = {
    id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    message: cleanMessage,
    type,
    element: toast,
    textSpan,
    count: 1,
    timeoutId: null,
    dismiss: (fast = false) => {
      clearTimeout(record.timeoutId);
      // Immediately release pointer events so clicks pass through without delay
      toast.style.pointerEvents = 'none';

      const idx = activeToasts.indexOf(record);
      if (idx !== -1) activeToasts.splice(idx, 1);

      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-2', 'opacity-0');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, fast ? 100 : 200);
    }
  };
  return record;
}

/**
 * Displays a non-intrusive toast notification with auto-coalescing and FIFO eviction.
 * @param {string} message - Notification text
 * @param {'info' | 'success' | 'error' | 'warning'} [type='info'] - Semantic variant
 * @param {number} [duration=2500] - Lifespan in milliseconds
 */
export function showToast(message, type = 'info', duration = DEFAULT_DURATION) {
  const container = getToastContainer();
  if (!container) return;

  const cleanMessage = String(message || '').trim();
  if (!cleanMessage) return;

  // 1. Deduplication / Coalescing: Check if identical active toast exists
  const existing = activeToasts.find((t) => t.message === cleanMessage && t.type === type);
  if (existing) {
    existing.count += 1;
    clearTimeout(existing.timeoutId);

    let badge = existing.element.querySelector('.toast-counter-badge');
    if (!badge && existing.textSpan) {
      badge = document.createElement('span');
      badge.className = 'toast-counter-badge px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/20 dark:bg-white/25 ml-1.5 shrink-0 select-none';
      existing.textSpan.appendChild(badge);
    }
    if (badge) badge.textContent = `×${existing.count}`;

    // Gentle pulse animation to notify user of updated count
    existing.element.classList.remove('scale-102');
    void existing.element.offsetWidth;
    existing.element.classList.add('scale-102');
    setTimeout(() => existing.element?.classList.remove('scale-102'), 150);

    existing.timeoutId = setTimeout(() => existing.dismiss(), duration);
    return;
  }

  // 2. FIFO Capacity Enforcement
  evictOldestIfFull();

  // 3. Create new Toast DOM element
  const toast = document.createElement('div');
  const { icon, styles } = getToastStyling(type);
  toast.className = `pointer-events-auto flex items-center justify-between gap-2.5 p-3 rounded-xl border text-xs sm:text-sm font-medium shadow-xl transition-all duration-200 transform translate-y-2 opacity-0 select-none ${styles}`;

  toast.innerHTML = `
    <div class="flex items-center gap-2.5 min-w-0 flex-1">
      <i data-lucide="${icon}" class="w-4 h-4 shrink-0"></i>
      <span class="toast-message-text truncate leading-relaxed">${cleanMessage}</span>
    </div>
    <button type="button" class="btn-toast-close p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition cursor-pointer shrink-0" title="Đóng">
      <i data-lucide="x" class="w-3.5 h-3.5"></i>
    </button>
  `;

  const textSpan = typeof toast.querySelector === 'function' ? toast.querySelector('.toast-message-text') : null;
  const toastRecord = createToastRecord(toast, cleanMessage, type, textSpan);

  const closeBtn = typeof toast.querySelector === 'function' ? toast.querySelector('.btn-toast-close') : null;
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      toastRecord.dismiss();
    };
  }

  toast.onclick = (e) => {
    if (e.target !== closeBtn && !closeBtn?.contains?.(e.target)) {
      toastRecord.dismiss();
    }
  };

  container.appendChild(toast);
  activeToasts.push(toastRecord);

  if (window.lucide) window.lucide.createIcons({ root: toast });

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  toastRecord.timeoutId = setTimeout(() => toastRecord.dismiss(), duration);
}

/**
 * Actionable Toast with an interactive button (e.g., "Mở ngay")
 * @param {string} message
 * @param {Object} [options]
 * @param {'info'|'success'|'error'|'warning'} [options.type='success']
 * @param {string} [options.actionText='Mở ngay']
 * @param {() => void} [options.onAction]
 * @param {number} [options.duration=6000]
 */
export function showActionableToast(message, { type = 'success', actionText = 'Mở ngay', onAction, duration = 6000 } = {}) {
  const container = getToastContainer();
  if (!container) return;

  const cleanMessage = String(message || '').trim();
  if (!cleanMessage) return;

  evictOldestIfFull();

  const toast = document.createElement('div');
  const { icon, styles } = getToastStyling(type);
  toast.className = `pointer-events-auto flex items-center justify-between gap-3 p-3 rounded-xl border text-xs sm:text-sm font-medium shadow-xl transition-all duration-200 transform translate-y-2 opacity-0 ${styles}`;

  toast.innerHTML = `
    <div class="flex items-center gap-2.5 min-w-0 flex-1">
      <i data-lucide="${icon}" class="w-4 h-4 text-emerald-400 shrink-0"></i>
      <span class="truncate text-zinc-100 font-medium">${cleanMessage}</span>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <button type="button" class="btn-toast-action px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition cursor-pointer">
        ${actionText}
      </button>
      <button type="button" class="btn-toast-dismiss p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer">
        <i data-lucide="x" class="w-3.5 h-3.5"></i>
      </button>
    </div>
  `;

  const toastRecord = createToastRecord(toast, cleanMessage, type);

  const actionBtn = typeof toast.querySelector === 'function' ? toast.querySelector('.btn-toast-action') : null;
  if (actionBtn) {
    actionBtn.onclick = (e) => {
      e.stopPropagation();
      toastRecord.dismiss();
      if (typeof onAction === 'function') onAction();
    };
  }

  const dismissBtn = typeof toast.querySelector === 'function' ? toast.querySelector('.btn-toast-dismiss') : null;
  if (dismissBtn) {
    dismissBtn.onclick = (e) => {
      e.stopPropagation();
      toastRecord.dismiss();
    };
  }

  container.appendChild(toast);
  activeToasts.push(toastRecord);

  if (window.lucide) window.lucide.createIcons({ root: toast });

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  toastRecord.timeoutId = setTimeout(() => toastRecord.dismiss(), duration);
}

/**
 * Clears and dismisses all currently active toasts immediately.
 */
export function clearAllToasts() {
  while (activeToasts.length > 0) {
    const t = activeToasts[0];
    t.dismiss(true);
  }
}

/**
 * Returns the count of currently active toasts (useful for testing & assertions).
 * @returns {number}
 */
export function getActiveToastsCount() {
  return activeToasts.length;
}
