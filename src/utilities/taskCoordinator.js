/**
 * DuyDev Studio - Universal Multitasking Task Coordinator
 * Central registry and reactive event bus orchestrating background tasks
 * across all existing and future studio modules.
 */

import { showActionableToast } from './toast.js';

/**
 * @typedef {Object} ActiveTask
 * @property {string} id Unique task identifier (e.g. 'archive-task-1', 'pdf-job-123')
 * @property {string} moduleId Module identifier ('archive', 'pdf-studio', 'universal-converter', etc.)
 * @property {string} moduleTitle Human readable module name ('Xem Tệp Nén', 'PDF Studio', etc.)
 * @property {string} title Task label or file name ('data.zip', 'Ghép 3 tệp PDF')
 * @property {'running'|'completed'|'error'|'idle'} status Current task execution status
 * @property {number} progress 0 to 100 percentage
 * @property {string} stage Current descriptive stage ('Đang truyền 45% (3.2 MB/s)', 'Đang ghép trang...')
 * @property {string} route Hash route for deep-link navigation ('#archive', '#tool/pdf-studio', etc.)
 * @property {() => void} [cancel] Optional cancellation callback
 * @property {string} [resultUrl] Optional result/download URL
 */

/**
 * @typedef {Object} IModuleTaskManager
 * @property {string} moduleId
 * @property {string} moduleTitle
 * @property {string} route
 * @property {() => ActiveTask[]} getActiveTasks
 * @property {(listener: (event?: string, data?: any) => void) => (() => void)} subscribe
 * @property {(taskId: string) => void} [cancelTask]
 */

class TaskCoordinator {
  constructor() {
    if (typeof window !== 'undefined' && window.__ds_taskCoordinator) {
      return window.__ds_taskCoordinator;
    }

    /** @type {Map<string, IModuleTaskManager>} */
    this.managers = new Map();
    /** @type {Map<string, () => void>} */
    this.managerUnsubscribers = new Map();
    /** @type {Set<(tasks: ActiveTask[]) => void>} */
    this.subscribers = new Set();
    /** @type {Map<string, string>} */
    this.lastStatuses = new Map();
    /** @type {ActiveTask[]} */
    this.cachedTasks = [];
    /** @type {number|null} */
    this.heartbeatTimer = null;
    this.initialized = false;

    if (typeof window !== 'undefined') {
      window.__ds_taskCoordinator = this;
    }
  }

  /**
   * Initializes the coordinator and sets up a periodic heartbeat.
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof window !== 'undefined') {
      // Dynamic lifecycle management: pause timers when page/app is in background
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stopHeartbeat();
        } else {
          this.syncTasks(true);
          this.updateHeartbeatState();
        }
      });
      this.updateHeartbeatState();
    }
  }

  hasActiveRunningTasks() {
    return this.cachedTasks.some((t) => t.status === 'running');
  }

  updateHeartbeatState() {
    if (typeof window === 'undefined') return;
    if (document.hidden || !this.hasActiveRunningTasks()) {
      this.stopHeartbeat();
    } else if (!this.heartbeatTimer) {
      this.startHeartbeat();
    }
  }

  startHeartbeat() {
    if (this.heartbeatTimer || typeof window === 'undefined') return;
    this.heartbeatTimer = window.setInterval(() => {
      this.syncTasks();
    }, 2500);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Registers a module task manager with the coordinator.
   * Enables automatic background multitasking, dock visualization, and completion alerts.
   * @param {IModuleTaskManager} manager
   * @returns {() => void} Teardown unregister function
   */
  registerManager(manager) {
    if (!manager || !manager.moduleId) return () => {};

    // If already registered, unregister previous instance first
    this.unregisterManager(manager.moduleId);

    this.managers.set(manager.moduleId, manager);

    // Subscribe to manager notifications
    if (typeof manager.subscribe === 'function') {
      const unsub = manager.subscribe(() => {
        this.syncTasks();
      });
      this.managerUnsubscribers.set(manager.moduleId, unsub);
    }

    this.syncTasks(true);

    return () => this.unregisterManager(manager.moduleId);
  }

  /**
   * Unregisters a module manager.
   * @param {string} moduleId
   */
  unregisterManager(moduleId) {
    if (this.managerUnsubscribers.has(moduleId)) {
      try {
        const unsub = this.managerUnsubscribers.get(moduleId);
        unsub?.();
      } catch (_) {}
      this.managerUnsubscribers.delete(moduleId);
    }
    this.managers.delete(moduleId);
    this.syncTasks(true);
  }

  /**
   * Synchronizes active tasks across all registered managers.
   * @param {boolean} [force=false] Force notification regardless of diff
   */
  syncTasks(force = false) {
    const currentTasks = [];

    this.managers.forEach((manager) => {
      try {
        if (typeof manager.getActiveTasks === 'function') {
          const tasks = manager.getActiveTasks() || [];
          tasks.forEach((t) => {
            if (t && t.id) {
              currentTasks.push({
                ...t,
                moduleId: t.moduleId || manager.moduleId,
                moduleTitle: t.moduleTitle || manager.moduleTitle,
                route: t.route || manager.route
              });
            }
          });
        }
      } catch (err) {
        console.warn(`[TaskCoordinator] Error syncing manager ${manager.moduleId}:`, err);
      }
    });

    // Detect status transitions (e.g. running -> completed)
    currentTasks.forEach((task) => {
      const prevStatus = this.lastStatuses.get(task.id);
      if (prevStatus === 'running' && task.status === 'completed') {
        this.notifyCompletion(task);
      }
      this.lastStatuses.set(task.id, task.status);
    });

    // Clean up untracked task statuses
    const currentIds = new Set(currentTasks.map((t) => t.id));
    for (const id of this.lastStatuses.keys()) {
      if (!currentIds.has(id)) {
        this.lastStatuses.delete(id);
      }
    }

    // Check if currentTasks differs from cachedTasks
    let isDifferent = false;
    if (currentTasks.length !== this.cachedTasks.length) {
      isDifferent = true;
    } else {
      for (let i = 0; i < currentTasks.length; i++) {
        const a = currentTasks[i];
        const b = this.cachedTasks[i];
        if (
          a.id !== b.id ||
          a.status !== b.status ||
          a.progress !== b.progress ||
          a.stage !== b.stage ||
          a.title !== b.title ||
          a.route !== b.route
        ) {
          isDifferent = true;
          break;
        }
      }
    }

    this.cachedTasks = currentTasks;
    if (isDifferent || force) {
      this.notifySubscribers();
    }
    this.updateHeartbeatState();
  }

  /**
   * Triggers an actionable toast when a background task finishes.
   * @param {ActiveTask} task
   */
  notifyCompletion(task) {
    showActionableToast(`${task.moduleTitle}: "${task.title}" đã hoàn tất`, {
      type: 'success',
      actionText: 'Mở ngay',
      onAction: () => {
        if (task.route) {
          window.location.hash = task.route;
        }
      }
    });
  }

  /**
   * Returns list of tasks that are currently active and running in background.
   * @returns {ActiveTask[]}
   */
  getActiveTasks() {
    return this.cachedTasks.filter((t) => t.status === 'running');
  }

  /**
   * Returns all current tasks including running and recently completed.
   * @returns {ActiveTask[]}
   */
  getAllTasks() {
    return [...this.cachedTasks];
  }

  /**
   * Cancels a specific task by its id.
   * @param {string} taskId
   */
  cancelTask(taskId) {
    const task = this.cachedTasks.find((t) => t.id === taskId);
    if (!task) return;

    if (typeof task.cancel === 'function') {
      try {
        task.cancel();
      } catch (_) {}
    }

    const manager = this.managers.get(task.moduleId);
    if (manager && typeof manager.cancelTask === 'function') {
      try {
        manager.cancelTask(taskId);
      } catch (_) {}
    }

    this.syncTasks(true);
  }

  /**
   * Subscribes a listener to active task changes.
   * @param {(tasks: ActiveTask[]) => void} listener
   * @returns {() => void} Teardown unsubscribe function
   */
  subscribe(listener) {
    this.subscribers.add(listener);
    try {
      listener(this.getActiveTasks());
    } catch (_) {}
    return () => {
      this.subscribers.delete(listener);
    };
  }

  /**
   * Notifies all registered subscribers.
   */
  notifySubscribers() {
    const active = this.getActiveTasks();
    this.subscribers.forEach((fn) => {
      try {
        fn(active);
      } catch (err) {
        console.warn('[TaskCoordinator] Subscriber error:', err);
      }
    });
  }

  /**
   * Disposes of timers and listeners.
   */
  destroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.managerUnsubscribers.forEach((unsub) => {
      try { unsub(); } catch (_) {}
    });
    this.managerUnsubscribers.clear();
    this.managers.clear();
    this.subscribers.clear();
    this.initialized = false;
  }
}

export const taskCoordinator = new TaskCoordinator();
