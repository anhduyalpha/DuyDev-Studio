/**
 * useHashActions - Crypto calculation and Base64 helpers
 * Integrated with taskCoordinator for background task visibility.
 */

import { showToast } from '../../../../utilities/toast.js';
import { taskCoordinator } from '../../../../utilities/taskCoordinator.js';
import { computeTextHashes, computeFileHashesStreaming } from '../../../../utilities/hashStream.js';

export function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function calculateTextHashes(text) {
  return computeTextHashes(text);
}

class HashManager {
  constructor() {
    this.moduleId = 'hash-checksum';
    this.moduleTitle = 'Mã Băm & Base64';
    this.route = '#tool/hash-checksum';
    this.activeFile = null;
    this.isHashing = false;
    this.progress = 0;
    this.abortController = null;
    this.subscribers = new Set();
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  notify() {
    this.subscribers.forEach((fn) => typeof fn === 'function' && fn());
  }

  getActiveTasks() {
    if (!this.isHashing) return [];
    return [
      {
        id: 'hash-calc-job',
        moduleId: this.moduleId,
        moduleTitle: this.moduleTitle,
        title: this.activeFile?.name ? `Mã băm: ${this.activeFile.name}` : 'Tính toán mã băm',
        status: 'running',
        progress: this.progress || 50,
        stage: 'Đang băm file (Web Crypto)...',
        route: this.route
      }
    ];
  }
}

export const hashManager = new HashManager();
taskCoordinator.registerManager(hashManager);

export async function processHashFile(file, hashState, onReRender) {
  hashManager.abort();
  const controller = new AbortController();
  hashManager.abortController = controller;

  hashState.file = file;
  hashState.isHashing = true;
  hashState.fileHashes = null;
  hashState.compareMatch = null;
  hashState.hashProgress = 0;
  hashManager.isHashing = true;
  hashManager.activeFile = file;
  hashManager.progress = 0;
  hashManager.notify();

  if (onReRender) onReRender();

  try {
    const hashes = await computeFileHashesStreaming(file, {
      signal: controller.signal,
      onProgress: (pct) => {
        hashManager.progress = pct;
        hashState.hashProgress = pct;
        hashManager.notify();
      }
    });

    hashState.fileHashes = hashes;

    if (hashState.compareHash) {
      const val = hashState.compareHash.toLowerCase();
      hashState.compareMatch = Object.values(hashState.fileHashes).some((h) => h.toLowerCase() === val);
    }

    hashManager.progress = 100;
    hashState.hashProgress = 100;
    showToast(`Đã tính mã băm xong cho ${file.name}`, 'success');
  } catch (err) {
    if (err?.name === 'AbortError') {
      return;
    }
    showToast(`Lỗi khi tính mã băm: ${err.message}`, 'error');
  } finally {
    if (hashManager.abortController === controller) {
      hashManager.abortController = null;
    }
    hashState.isHashing = false;
    hashManager.isHashing = false;
    hashManager.notify();
    if (onReRender) onReRender();
  }
}

export function updateBase64(hashState) {
  const input = hashState.base64Input;
  if (!input) {
    hashState.base64Output = '';
    return;
  }
  try {
    if (hashState.base64Mode === 'encode') {
      hashState.base64Output = btoa(unescape(encodeURIComponent(input)));
    } else {
      hashState.base64Output = decodeURIComponent(escape(atob(input.trim())));
    }
  } catch {
    hashState.base64Output = 'Lỗi Base64 không hợp lệ';
  }
}
