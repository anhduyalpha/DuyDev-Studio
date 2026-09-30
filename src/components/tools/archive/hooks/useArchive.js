/**
 * DuyDev Studio - Archive Manager Singleton
 * Zero-Extraction Archive Browser & Nested Archive Explorer State.
 * Fully decoupled from DOM lifecycles to enable true background multitasking.
 */

import { inspectArchiveFile } from './useArchiveInspect.js';
import { getFilesInFolder } from './archiveTreeHelper.js';
import { loadModuleState, saveModuleState } from '../../../../utilities/moduleState.js';
import { ResumableUploader } from '../../../../utilities/resumableUploader.js';
import { showToast } from '../../../../utilities/toast.js';
import { taskCoordinator } from '../../../../utilities/taskCoordinator.js';

export class ArchiveManager {
  constructor() {
    this.moduleId = 'archive';
    this.moduleTitle = 'Xem Tệp Nén';
    this.route = '#archive';

    this.archiveData = null;
    this.archiveStack = [];
    this.currentFolder = '/';
    this.isUploading = false;
    this.uploadStage = '';
    this.uploadingFileName = '';
    this.uploadTelemetry = { percent: 0, formattedSpeed: '0 KB/s', formattedEta: '--' };
    this.checkpoint = null;
    this.error = null;
    this.activeUploader = null;
    this.listeners = new Set();

    // Hydrate persisted state
    const saved = loadModuleState('archive', null);
    if (saved) {
      if (saved.archiveData) this.archiveData = saved.archiveData;
      if (saved.currentFolder) this.currentFolder = saved.currentFolder;
      if (Array.isArray(saved.archiveStack)) this.archiveStack = saved.archiveStack;
    }
  }

  persist() {
    saveModuleState('archive', {
      archiveData: this.archiveData,
      currentFolder: this.currentFolder,
      archiveStack: this.archiveStack
    });
  }

  getState() {
    this.checkpoint = ResumableUploader.getCheckpoint();
    return {
      archiveData: this.archiveData,
      archiveStack: this.archiveStack,
      currentFolder: this.currentFolder,
      isUploading: this.isUploading,
      uploadStage: this.uploadStage,
      uploadingFileName: this.uploadingFileName,
      uploadTelemetry: this.uploadTelemetry,
      checkpoint: this.checkpoint,
      error: this.error,
      activeUploader: this.activeUploader
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event = 'update', data = null) {
    const list = Array.from(this.listeners);
    list.forEach((fn) => {
      try {
        fn(event, data);
      } catch (err) {
        console.warn('[ArchiveManager] Listener error:', err);
      }
    });
  }

  /**
   * Returns active background tasks for the Task Coordinator.
   * @returns {import('../../../../utilities/taskCoordinator.js').ActiveTask[]}
   */
  getActiveTasks() {
    if (!this.isUploading) return [];
    return [
      {
        id: 'archive-upload',
        moduleId: this.moduleId,
        moduleTitle: this.moduleTitle,
        title: this.uploadingFileName || 'Tệp nén',
        status: 'running',
        progress: this.uploadTelemetry?.percent || 0,
        stage: this.uploadStage || 'Đang tải lên...',
        route: this.route,
        cancel: () => this.cancelUpload()
      }
    ];
  }

  cancelTask(taskId) {
    if (taskId === 'archive-upload') {
      this.cancelUpload();
    }
  }

  async startUpload(file, existingCheckpoint = null) {
    if (!file) return;

    this.isUploading = true;
    this.error = null;
    this.uploadingFileName = file.name;
    this.uploadStage = 'Đang khởi tạo phiên tải lên...';
    this.uploadTelemetry = { percent: 0, formattedSpeed: '0 KB/s', formattedEta: '--' };
    this.notify('upload-start');

    try {
      const data = await inspectArchiveFile(file, {
        existingUploadId: existingCheckpoint?.uploadId,
        onUploaderCreated: (u) => {
          this.activeUploader = u;
        },
        onStage: (st) => {
          this.uploadStage = st;
          this.notify('upload-stage', st);
        },
        onProgress: (t) => {
          this.uploadTelemetry = t;
          this.notify('upload-progress', t);
        }
      });

      this.archiveStack = [];
      this.archiveData = data;
      this.currentFolder = '/';
      this.isUploading = false;
      this.activeUploader = null;
      this.persist();

      showToast('Phân tích hoàn tất', 'success');
      this.notify('upload-complete', data);
    } catch (err) {
      this.isUploading = false;
      this.activeUploader = null;

      if (err.message === 'Đã hủy tải tệp lên' || err.message === 'Đã huỷ tải lên') {
        showToast('Đã huỷ tải lên', 'info');
        this.notify('upload-canceled');
      } else {
        this.error = err.message || 'Lỗi khi đọc file nén';
        showToast(this.error, 'error');
        this.notify('upload-error', this.error);
      }
    }
  }

  cancelUpload() {
    if (this.activeUploader) {
      try {
        this.activeUploader.cancel();
      } catch (_) {}
      this.activeUploader = null;
    }
    this.isUploading = false;
    this.uploadStage = '';
    showToast('Đã huỷ tải lên', 'info');
    this.notify('upload-canceled');
  }

  selectFolder(folderPath) {
    if (!this.archiveData || !folderPath) return;
    this.currentFolder = folderPath;
    this.archiveData.currentFiles = getFilesInFolder(this.archiveData.allEntries, folderPath);
    this.persist();
    this.notify('folder-select', folderPath);
  }

  pushNestedArchive(nestedData) {
    if (!nestedData) return;
    if (this.archiveData) {
      this.archiveData.savedFolder = this.currentFolder;
      this.archiveStack.push(this.archiveData);
    }
    this.archiveData = nestedData;
    this.currentFolder = '/';
    this.persist();
    this.notify('nested-open', nestedData);
  }

  popArchiveStack() {
    if (!this.archiveStack.length) return;
    const parent = this.archiveStack.pop();
    const savedFolder = parent.savedFolder || '/';
    delete parent.savedFolder;
    this.archiveData = parent;
    this.currentFolder = savedFolder;
    this.archiveData.currentFiles = getFilesInFolder(this.archiveData.allEntries, savedFolder);
    this.persist();
    this.notify('nested-back', parent);
  }

  changeArchive() {
    this.archiveData = null;
    this.archiveStack = [];
    this.currentFolder = '/';
    this.persist();
    this.notify('archive-change');
  }

  dismissError() {
    this.error = null;
    this.notify('error-dismiss');
  }

  dismissCheckpoint() {
    ResumableUploader.clearCheckpoint();
    this.checkpoint = null;
    this.notify('checkpoint-dismiss');
  }
}

export const archiveManager = new ArchiveManager();
taskCoordinator.registerManager(archiveManager);
