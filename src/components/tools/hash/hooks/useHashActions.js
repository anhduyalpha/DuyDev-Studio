/**
 * useHashActions - Crypto calculation and Base64 helpers
 * Integrated with taskCoordinator for background task visibility.
 */

import { showToast } from '../../../../utilities/toast.js';
import { taskCoordinator } from '../../../../utilities/taskCoordinator.js';

export function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function calculateTextHashes(text) {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const [sha256Buf, sha1Buf, sha512Buf] = await Promise.all([
    crypto.subtle.digest('SHA-256', data),
    crypto.subtle.digest('SHA-1', data),
    crypto.subtle.digest('SHA-512', data)
  ]);

  return {
    sha256: bufferToHex(sha256Buf),
    sha1: bufferToHex(sha1Buf),
    sha512: bufferToHex(sha512Buf)
  };
}

class HashManager {
  constructor() {
    this.moduleId = 'hash-checksum';
    this.moduleTitle = 'Mã Băm & Base64';
    this.route = '#tool/hash-checksum';
    this.activeFile = null;
    this.isHashing = false;
    this.progress = 0;
    this.subscribers = new Set();
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
  hashState.file = file;
  hashState.isHashing = true;
  hashState.fileHashes = null;
  hashState.compareMatch = null;
  hashManager.isHashing = true;
  hashManager.activeFile = file;
  hashManager.progress = 30;
  hashManager.notify();

  if (onReRender) onReRender();

  try {
    const arrayBuffer = await file.arrayBuffer();
    hashManager.progress = 70;
    hashManager.notify();

    const [sha256Buf, sha1Buf, sha512Buf] = await Promise.all([
      crypto.subtle.digest('SHA-256', arrayBuffer),
      crypto.subtle.digest('SHA-1', arrayBuffer),
      crypto.subtle.digest('SHA-512', arrayBuffer)
    ]);

    hashState.fileHashes = {
      sha256: bufferToHex(sha256Buf),
      sha1: bufferToHex(sha1Buf),
      sha512: bufferToHex(sha512Buf)
    };

    if (hashState.compareHash) {
      const val = hashState.compareHash.toLowerCase();
      hashState.compareMatch = Object.values(hashState.fileHashes).some((h) => h.toLowerCase() === val);
    }

    hashManager.progress = 100;
    showToast(`Đã tính mã băm xong cho ${file.name}`, 'success');
  } catch (err) {
    showToast(`Lỗi khi tính mã băm: ${err.message}`, 'error');
  } finally {
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
