/**
 * DuyDev Studio - GlobalTaskDock Component
 * Floating, non-intrusive multitasking dock displaying active background jobs
 * across all modules (Archive, PDF, Converter, Studocu, etc.).
 * Linear/Vercel developer utility aesthetic (Rule 3).
 * Selective in-place DOM diffing prevents layout thrashing & flickering (KI-FIX-010).
 */

import { taskCoordinator } from '../../utilities/taskCoordinator.js';

let isMinimized = false;

/**
 * Renders the HTML structure for an individual task item in the Glassmorphic Micro-Dock.
 * Inline layout: Micro-badge, truncated description, percentage and sub-pixel progress thread.
 * Secondary verbose stage details collapse by default and slide-expand on hover/click.
 * @param {import('../../utilities/taskCoordinator.js').ActiveTask} task
 * @returns {string}
 */
export function renderTaskRow(task) {
  const pct = Math.max(0, Math.min(100, Math.round(task.progress || 0)));

  return `
    <div 
      class="group/item relative flex flex-col gap-1 py-1 px-1.5 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-all cursor-pointer"
      data-task-route="${task.route || ''}"
      data-task-id="${task.id}"
      title="Nhấn để mở ${task.moduleTitle}"
    >
      <!-- Single Horizontal Row: Badge + Description + Percentage -->
      <div class="flex items-center justify-between gap-2 min-w-0">
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <span class="px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-bold uppercase tracking-wider bg-black/[0.05] dark:bg-white/[0.08] text-zinc-600 dark:text-zinc-300 border border-black/[0.04] dark:border-white/[0.06] shrink-0">
            ${task.moduleTitle}
          </span>
          <span class="dock-task-title text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
            ${task.title || 'Tác vụ'}
          </span>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <span class="dock-pct-text text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
            ${pct}%
          </span>
          ${
            task.cancel
              ? `<button 
                  class="btn-cancel-dock-task opacity-0 group-hover/item:opacity-100 p-0.5 rounded hover:bg-red-500/10 hover:text-red-500 text-zinc-400 transition cursor-pointer"
                  data-cancel-id="${task.id}"
                  title="Hủy tác vụ"
                >
                  <i data-lucide="x" class="w-3 h-3"></i>
                </button>`
              : ''
          }
        </div>
      </div>

      <!-- Collapsible Secondary Stage Details (Expands on hover) -->
      <div class="dock-stage-row max-h-0 opacity-0 group-hover/item:max-h-6 group-hover/item:opacity-100 overflow-hidden transition-all duration-200 ease-out text-[11px] text-zinc-500 dark:text-zinc-400 font-sans truncate">
        <span class="dock-stage-text truncate">${task.stage || 'Đang xử lý...'}</span>
      </div>

      <!-- Sub-pixel Micro-gradient Progress Thread -->
      <div class="w-full bg-zinc-200/50 dark:bg-white/[0.08] h-[2px] rounded-full overflow-hidden">
        <div 
          class="dock-progress-bar dock-progress-thread h-[2px] rounded-full transition-all duration-300 ease-out" 
          style="width: ${pct}%"
        ></div>
      </div>
    </div>
  `;
}

/**
 * Renders the entire dock capsule container for initial mounting.
 * @param {import('../../utilities/taskCoordinator.js').ActiveTask[]} tasks
 * @returns {string}
 */
export function renderGlobalTaskDock(tasks = []) {
  if (!tasks || tasks.length === 0) {
    return '';
  }

  const count = tasks.length;

  return `
    <div id="globalTaskDockCapsule" class="fixed bottom-20 right-4 sm:bottom-5 sm:right-5 z-50 flex flex-col items-end gap-1.5 w-[calc(100vw-2rem)] sm:w-[340px] max-w-[340px] select-none pointer-events-none">
      <div class="task-micro-dock pointer-events-auto w-full rounded-2xl p-2.5 transition-all duration-300">
        
        <!-- Dock Micro-Header -->
        <div class="flex items-center justify-between pb-1.5 mb-1 border-b border-black/[0.05] dark:border-white/[0.06] px-1">
          <div class="flex items-center gap-1.5">
            <span class="relative flex h-1.5 w-1.5 shrink-0">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span id="dockTaskCountText" class="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 tracking-tight">
              ${count} ${count === 1 ? 'tác vụ đang chạy' : 'tác vụ đang chạy'}
            </span>
          </div>

          <div class="flex items-center gap-1">
            <button 
              id="btnToggleDockMinimize" 
              class="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer"
              title="${isMinimized ? 'Mở rộng' : 'Thu nhỏ'}"
            >
              <i data-lucide="${isMinimized ? 'chevron-up' : 'chevron-down'}" class="w-3 h-3"></i>
            </button>
          </div>
        </div>

        <!-- Task List Items -->
        <div id="dockTasksContainer" class="space-y-1 max-h-60 overflow-y-auto ${isMinimized ? 'hidden' : ''}">
          ${tasks.map(renderTaskRow).join('')}
        </div>

      </div>
    </div>
  `;
}

/**
 * Attaches DOM click listeners for task rows and cancel buttons via event delegation.
 * @param {HTMLElement} container
 */
function attachDockListeners(container) {
  const btnToggle = container.querySelector('#btnToggleDockMinimize');
  if (btnToggle) {
    btnToggle.onclick = (e) => {
      e.stopPropagation();
      isMinimized = !isMinimized;
      const tasksEl = container.querySelector('#dockTasksContainer');
      if (tasksEl) {
        tasksEl.classList.toggle('hidden', isMinimized);
      }
      btnToggle.title = isMinimized ? 'Mở rộng' : 'Thu nhỏ';
      btnToggle.innerHTML = `<i data-lucide="${isMinimized ? 'chevron-up' : 'chevron-down'}" class="w-3 h-3"></i>`;
      if (window.lucide) window.lucide.createIcons({ root: btnToggle });
    };
  }

  const tasksContainer = container.querySelector('#dockTasksContainer');
  if (tasksContainer) {
    tasksContainer.onclick = (e) => {
      const cancelBtn = e.target.closest('.btn-cancel-dock-task');
      if (cancelBtn) {
        e.stopPropagation();
        const taskId = cancelBtn.getAttribute('data-cancel-id');
        if (taskId) {
          taskCoordinator.cancelTask(taskId);
        }
        return;
      }

      const row = e.target.closest('[data-task-route]');
      if (row) {
        const route = row.getAttribute('data-task-route');
        if (route) {
          window.location.hash = route;
        }
      }
    };
  }
}

/**
 * Updates the GlobalTaskDock DOM in-place to prevent flicker, layout thrashing,
 * and CSS keyframe animation restarts (Rule 1 & Rule 3).
 * @param {HTMLElement} host
 * @param {import('../../utilities/taskCoordinator.js').ActiveTask[]} tasks
 */
export function updateDockDOM(host, tasks = []) {
  if (!tasks || tasks.length === 0) {
    if (host.innerHTML !== '') {
      host.innerHTML = '';
    }
    return;
  }

  const capsule = host.querySelector('#globalTaskDockCapsule');
  if (!capsule) {
    // Initial mount: create capsule with entrance animation
    host.innerHTML = renderGlobalTaskDock(tasks);
    attachDockListeners(host);
    if (window.lucide) window.lucide.createIcons({ root: host });
    return;
  }

  // Capsule already exists: selective in-place mutation
  const countEl = capsule.querySelector('#dockTaskCountText');
  if (countEl) {
    const newText = `${tasks.length} tác vụ đang chạy`;
    if (countEl.textContent !== newText) {
      countEl.textContent = newText;
    }
  }

  const tasksContainer = capsule.querySelector('#dockTasksContainer');
  if (!tasksContainer) return;

  const currentIds = new Set(tasks.map((t) => t.id));
  const existingRows = Array.from(tasksContainer.querySelectorAll('[data-task-id]'));

  // 1. Remove rows for tasks that are no longer active
  existingRows.forEach((row) => {
    const id = row.getAttribute('data-task-id');
    if (!currentIds.has(id)) {
      row.remove();
    }
  });

  // 2. Reconcile task rows (update in-place or append new)
  tasks.forEach((task) => {
    const row = tasksContainer.querySelector(`[data-task-id="${task.id}"]`);
    const pct = Math.max(0, Math.min(100, Math.round(task.progress || 0)));

    if (row) {
      // In-place leaf mutation
      const pctEl = row.querySelector('.dock-pct-text');
      if (pctEl && pctEl.textContent.trim() !== `${pct}%`) {
        pctEl.textContent = `${pct}%`;
      }

      const barEl = row.querySelector('.dock-progress-bar');
      if (barEl && barEl.style.width !== `${pct}%`) {
        barEl.style.width = `${pct}%`;
      }

      const stageEl = row.querySelector('.dock-stage-text');
      const stageText = task.stage || 'Đang xử lý...';
      if (stageEl && stageEl.textContent !== stageText) {
        stageEl.textContent = stageText;
      }

      const titleEl = row.querySelector('.dock-task-title');
      const titleText = task.title || 'Tác vụ';
      if (titleEl && titleEl.textContent !== titleText) {
        titleEl.textContent = titleText;
      }

      const currentRoute = row.getAttribute('data-task-route');
      const newRoute = task.route || '';
      if (currentRoute !== newRoute) {
        row.setAttribute('data-task-route', newRoute);
      }
    } else {
      // New task row: create, append, and render icons
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = renderTaskRow(task).trim();
      const newRow = tempDiv.firstElementChild;
      if (newRow) {
        tasksContainer.appendChild(newRow);
        if (window.lucide) window.lucide.createIcons({ root: newRow });
      }
    }
  });
}

let dockUnsubscribe = null;

/**
 * Initializes the GlobalTaskDock singleton mount.
 * Subscribes to taskCoordinator and updates the DOM in-place.
 */
export function initGlobalTaskDock() {
  if (dockUnsubscribe) return;

  dockUnsubscribe = taskCoordinator.subscribe((tasks) => {
    const host = document.getElementById('globalTaskDockContainer');
    if (!host) return;
    updateDockDOM(host, tasks);
  });
}

