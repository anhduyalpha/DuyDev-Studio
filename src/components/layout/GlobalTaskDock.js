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
 * Renders the HTML structure for an individual task item.
 * @param {import('../../utilities/taskCoordinator.js').ActiveTask} task
 * @returns {string}
 */
export function renderTaskRow(task) {
  const pct = Math.max(0, Math.min(100, Math.round(task.progress || 0)));

  return `
    <div 
      class="group relative flex flex-col gap-1.5 p-2.5 rounded-xl bg-zinc-50/80 dark:bg-white/[0.03] hover:bg-zinc-100 dark:hover:bg-white/[0.06] border border-zinc-200/80 dark:border-white/[0.06] transition-all cursor-pointer"
      data-task-route="${task.route || ''}"
      data-task-id="${task.id}"
      title="Nhấn để mở ${task.moduleTitle}"
    >
      <div class="flex items-center justify-between gap-2 min-w-0">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 shrink-0">
            ${task.moduleTitle}
          </span>
          <span class="dock-task-title text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
            ${task.title || 'Tác vụ'}
          </span>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <span class="dock-pct-text text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
            ${pct}%
          </span>
          ${
            task.cancel
              ? `<button 
                  class="btn-cancel-dock-task opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/10 hover:text-red-500 text-zinc-400 transition cursor-pointer"
                  data-cancel-id="${task.id}"
                  title="Hủy tác vụ"
                >
                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>`
              : ''
          }
        </div>
      </div>

      <!-- Thin Progress Bar -->
      <div class="w-full bg-zinc-200/70 dark:bg-white/10 rounded-full h-1 overflow-hidden">
        <div 
          class="dock-progress-bar bg-indigo-600 dark:bg-indigo-400 h-1 rounded-full transition-all duration-300 ease-out" 
          style="width: ${pct}%"
        ></div>
      </div>

      <!-- Stage label -->
      <div class="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-sans truncate">
        <span class="dock-stage-text truncate">${task.stage || 'Đang xử lý...'}</span>
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
    <div id="globalTaskDockCapsule" class="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-2 max-w-sm w-[calc(100vw-2rem)] sm:w-88 select-none pointer-events-none">
      <div class="pointer-events-auto w-full bg-white/95 dark:bg-[#121215]/95 border border-zinc-200/90 dark:border-white/[0.1] shadow-2xl rounded-2xl p-3 backdrop-blur-md transition-all duration-200">
        
        <!-- Dock Header -->
        <div class="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100 dark:border-white/[0.06]">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-emerald-500 shrink-0 shadow-xs"></span>
            <span id="dockTaskCountText" class="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              ${count} tác vụ đang chạy
            </span>
          </div>

          <div class="flex items-center gap-1">
            <button 
              id="btnToggleDockMinimize" 
              class="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
              title="${isMinimized ? 'Mở rộng' : 'Thu nhỏ'}"
            >
              <i data-lucide="${isMinimized ? 'chevron-up' : 'chevron-down'}" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <!-- Task List Items -->
        <div id="dockTasksContainer" class="space-y-2 max-h-60 overflow-y-auto ${isMinimized ? 'hidden' : ''}">
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
      btnToggle.innerHTML = `<i data-lucide="${isMinimized ? 'chevron-up' : 'chevron-down'}" class="w-3.5 h-3.5"></i>`;
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

