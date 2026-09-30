/**
 * DuyDev Studio - Archive Compress Manager Singleton
 * State manager for server-side multi-format archive compression (#server-archive).
 * Implements IModuleTaskManager for background multitasking.
 */

import { compressFilesToServer } from './useArchiveCompress.js';
import { loadModuleState, saveModuleState } from '../../../../utilities/moduleState.js';
import { showToast } from '../../../../utilities/toast.js';
import { storage } from '../../../../utilities/storage.js';
import { taskCoordinator } from '../../../../utilities/taskCoordinator.js';

export class ArchiveCompressManager {
  constructor() {
    this.moduleId = 'server-archive';
    this.moduleTitle = 'Nén Tệp';
    this.route = '#server-archive';

    this.files = [];
    this.archiveName = 'archive.zip';
    this.format = 'zip';
    this.compressionLevel = 'normal';
    this.isCompressing = false;
    this.stage = '';
    this.progress = 0;
    this.result = null;
    this.error = null;
    this.listeners = new Set();

    const saved = loadModuleState('archive_compress', null);
    if (saved) {
      if (saved.archiveName) this.archiveName = saved.archiveName;
      if (saved.format) this.format = saved.format;
      if (saved.compressionLevel) this.compressionLevel = saved.compressionLevel;
    }
  }

  persist() {
    saveModuleState('archive_compress', {
      archiveName: this.archiveName,
      format: this.format,
      compressionLevel: this.compressionLevel
    });
  }

  getState() {
    return {
      files: this.files,
      archiveName: this.archiveName,
      format: this.format,
      compressionLevel: this.compressionLevel,
      isCompressing: this.isCompressing,
      stage: this.stage,
      progress: this.progress,
      result: this.result,
      error: this.error
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event = 'update') {
    const list = Array.from(this.listeners);
    list.forEach((fn) => {
      try {
        fn(event, this.getState());
      } catch (err) {
        console.warn('[ArchiveCompressManager] Listener error:', err);
      }
    });
  }

  getActiveTasks() {
    if (!this.isCompressing) return [];
    return [
      {
        id: 'archive-compress-job',
        moduleId: this.moduleId,
        moduleTitle: this.moduleTitle,
        title: `${this.archiveName} (${this.files.length} tệp)`,
        status: 'running',
        progress: this.progress || 10,
        stage: this.stage || 'Đang nén...',
        route: this.route
      }
    ];
  }

  addFiles(newFiles) {
    if (!newFiles?.length) return;
    const added = Array.from(newFiles).map((f) => ({
      name: f.name,
      size: f.size,
      rawFile: f
    }));
    this.files = [...this.files, ...added];
    this.notify('files-add');
  }

  removeFile(index) {
    this.files.splice(index, 1);
    this.notify('files-remove');
  }

  clearFiles() {
    this.files = [];
    this.notify('files-clear');
  }

  setArchiveName(name) {
    this.archiveName = name;
    this.persist();
  }

  setFormat(format) {
    this.format = format;
    this.persist();
  }

  setCompressionLevel(level) {
    this.compressionLevel = level;
    this.persist();
  }

  dismissError() {
    this.error = null;
    this.notify('error-dismiss');
  }

  resetResult() {
    this.result = null;
    this.files = [];
    this.persist();
    this.notify('result-reset');
  }

  async startCompress() {
    if (this.isCompressing) return;
    if (!this.files.length) {
      showToast('Vui lòng chọn tệp để nén', 'warning');
      return;
    }

    this.isCompressing = true;
    this.stage = 'Đang truyền các tệp lên server...';
    this.progress = 10;
    this.error = null;
    this.notify('compress-start');

    try {
      const res = await compressFilesToServer(
        this.files,
        {
          archiveName: this.archiveName,
          format: this.format,
          compressionLevel: this.compressionLevel
        },
        (msg) => {
          this.stage = msg;
          this.notify('compress-stage');
        },
        (prog) => {
          if (prog?.totalFiles > 0) {
            const filePct = (prog.currentFileIndex / prog.totalFiles) * 70;
            const chunkPct = ((prog.percent || 0) / 100) * (70 / prog.totalFiles);
            this.progress = Math.min(95, Math.round(filePct + chunkPct));
            this.notify('compress-progress');
          }
        }
      );

      this.result = res;
      this.isCompressing = false;
      this.progress = 100;
      this.persist();

      const hist = await storage.addHistoryItem({
        toolId: 'server-archive',
        toolTitle: 'Nén Tệp',
        fileName: res?.archiveName || this.archiveName,
        originalSize: res?.originalSizeBytes || 0,
        resultSize: res?.sizeBytes || 0,
        downloadUrl: res?.downloadUrl
      });

      if (hist?.id && this.result) {
        this.result.historyId = hist.id;
      }

      showToast('Đã tạo tệp nén thành công', 'success');
      this.notify('compress-complete');
    } catch (err) {
      this.isCompressing = false;
      this.error = err.message || 'Lỗi khi tạo tệp nén';
      showToast(this.error, 'error');
      this.notify('compress-error');
    }
  }
}

export const archiveCompressManager = new ArchiveCompressManager();
taskCoordinator.registerManager(archiveCompressManager);
