/**
 * useQuiz Hook & State Manager (< 250 lines)
 * Reactive state machine for Quiz Generator with defensive resource cleanup.
 */

import { uploadQuizFile, parsePromptApi, generateQuizJob, connectJobEvents } from './quizApi.js';
import { showToast } from '../../../../utilities/toast.js';
import { storage } from '../../../../utilities/storage.js';
import { saveQuizHistoryPair } from '../utilities/quizHistoryHelper.js';

export function isValidDriveUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) return false;
  try {
    const parsed = new URL(clean);
    return parsed.hostname.includes('drive.google.com') || parsed.hostname.includes('docs.google.com');
  } catch {
    return false;
  }
}

class QuizManager {
  constructor() {
    this.state = {
      file: null,
      fileId: null,
      gdriveUrl: '',
      pages: '',
      count: 20,
      start: 1,
      title: 'BÀI TẬP TRẮC NGHIỆM HÓA HỌC 12',
      subtitle: '',
      prefix: '',
      step: 1, // 1: Nguồn tài liệu, 2: Nhận diện thông minh, 3: Thông số chi tiết & Tạo đề
      isAnalyzingPrompt: false,
      isProcessing: false,
      progress: 0,
      stage: '',
      jobId: null,
      result: null, // { worksheet, answer, questionsCount }
      error: null
    };

    this.listeners = new Set();
    this.disconnectEvents = null;
    this.uploadAbortController = null;
  }

  getState() {
    return { ...this.state };
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(event) {
    for (const fn of this.listeners) {
      try {
        fn(this.getState(), event);
      } catch (err) {
        console.error('QuizManager listener error:', err);
      }
    }
  }

  async setFile(file) {
    if (this.uploadAbortController) {
      this.uploadAbortController.abort();
      this.uploadAbortController = null;
    }

    if (!file) {
      this.state.file = null;
      this.state.fileId = null;
      if (!isValidDriveUrl(this.state.gdriveUrl)) {
        this.state.step = 1;
      }
      this.notify('file-cleared');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showToast('Chỉ chấp nhận tệp định dạng PDF', 'error');
      return;
    }

    // Clear Google Drive URL when a file is explicitly chosen
    this.state.gdriveUrl = '';
    this.state.file = {
      name: file.name,
      size: file.size,
      status: 'uploading',
      uploadProgress: 0
    };
    this.state.fileId = null;
    this.state.error = null;
    this.notify('file-selected');

    this.uploadAbortController = new AbortController();
    try {
      const upRes = await uploadQuizFile(file, {
        signal: this.uploadAbortController.signal,
        onProgress: (p) => {
          if (this.state.file) {
            this.state.file.uploadProgress = Math.round(p.percentage || 0);
            this.notify('file-upload-progress');
          }
        },
        onStage: (s) => {
          if (this.state.file) {
            this.state.file.stage = s;
            this.notify('file-upload-progress');
          }
        }
      });

      this.state.fileId = upRes.fileId;
      this.state.file.status = 'ready';
      this.state.step = Math.max(this.state.step, 2);
      this.notify('file-uploaded');
      showToast('Đã nạp tệp PDF nguồn', 'success');
    } catch (err) {
      if (err.name === 'AbortError') return;
      this.state.file.status = 'error';
      this.state.error = err.message;
      this.notify('file-upload-error');
      showToast(err.message || 'Lỗi tải tệp PDF lên', 'error');
    }
  }

  setGdriveUrl(url) {
    const clean = (url || '').trim();
    this.state.gdriveUrl = clean;

    // If user enters a drive link, clear any previously chosen file
    if (clean) {
      if (this.uploadAbortController) {
        this.uploadAbortController.abort();
        this.uploadAbortController = null;
      }
      if (this.state.file) {
        this.state.file = null;
        this.state.fileId = null;
      }
    }

    const prevStep = this.state.step;
    const isDriveValid = isValidDriveUrl(clean);

    if (isDriveValid) {
      if (this.state.step < 2) {
        this.state.step = 2;
      }
    } else if (!this.state.file || this.state.file.status !== 'ready') {
      if (this.state.step !== 1) {
        this.state.step = 1;
      }
    }

    const stepChanged = this.state.step !== prevStep;
    this.notify(stepChanged ? 'step-changed' : 'gdrive-changed');
  }

  setParams(params = {}) {
    if (params.pages !== undefined) this.state.pages = String(params.pages).trim();
    if (params.count !== undefined) this.state.count = Math.max(1, Math.min(200, Number(params.count) || 20));
    if (params.start !== undefined) this.state.start = Math.max(1, Number(params.start) || 1);
    if (params.title !== undefined) this.state.title = String(params.title).trim();
    if (params.subtitle !== undefined) this.state.subtitle = String(params.subtitle).trim();
    if (params.prefix !== undefined) this.state.prefix = String(params.prefix).trim();
    this.notify('params-changed');
  }

  setCount(val) {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      this.state.count = Math.max(1, Math.min(200, num));
      this.notify('params-changed');
    }
  }

  async parsePrompt(promptText) {
    if (!promptText || !promptText.trim()) {
      showToast('Vui lòng nhập câu lệnh nhận diện', 'warning');
      return;
    }
    if (this.state.isAnalyzingPrompt) return;

    this.state.isAnalyzingPrompt = true;
    this.notify('prompt-analyzing');

    try {
      const parsed = await parsePromptApi(promptText);
      if (parsed) {
        if (parsed.pages !== undefined) this.state.pages = String(parsed.pages);
        if (parsed.count !== undefined) this.state.count = Number(parsed.count);
        if (parsed.start !== undefined) this.state.start = Number(parsed.start);
        if (parsed.prefix) this.state.prefix = String(parsed.prefix);
        if (parsed.title) this.state.title = String(parsed.title);
        this.state.step = 3;
        this.notify('prompt-parsed');
        showToast(`Đã nhận diện: Trang ${parsed.pages || '—'}, ${parsed.count || 20} câu (từ câu ${parsed.start || 1})`, 'success');
      }
    } catch (err) {
      showToast(err.message || 'Không thể nhận diện prompt', 'warning');
    } finally {
      this.state.isAnalyzingPrompt = false;
      this.notify('prompt-analysis-finished');
    }
  }

  skipToManualParams() {
    this.state.step = 3;
    this.notify('step-changed');
  }

  async startGeneration() {
    if (this.state.isProcessing) return;

    const hasFile = Boolean(this.state.fileId);
    const hasDrive = Boolean(this.state.gdriveUrl);

    if (!hasFile && !hasDrive) {
      showToast('Vui lòng chọn tệp PDF hoặc nhập liên kết Google Drive', 'warning');
      return;
    }

    if (this.state.file && this.state.file.status !== 'ready') {
      showToast('Vui lòng đợi tệp PDF tải lên hoàn tất', 'warning');
      return;
    }

    if (!this.state.pages || !this.state.pages.trim()) {
      showToast('Vui lòng nhập trang cần trích xuất', 'warning');
      return;
    }

    if (!this.state.prefix || !this.state.prefix.trim()) {
      showToast('Vui lòng nhập Tên File ( Bắt Buộc )', 'warning');
      return;
    }

    this.state.isProcessing = true;
    this.state.progress = 5;
    this.state.stage = 'Khởi tạo tác vụ tạo bài tập trắc nghiệm...';
    this.state.result = null;
    this.state.error = null;
    this.notify('job-started');

    try {
      const payload = {
        pages: this.state.pages.trim(),
        count: this.state.count,
        startNum: this.state.start,
        title: this.state.title || 'BÀI TẬP TRẮC NGHIỆM HÓA HỌC 12',
        subtitle: this.state.subtitle || '',
        prefix: this.state.prefix.trim()
      };

      if (this.state.fileId) {
        payload.fileId = this.state.fileId;
      } else if (this.state.gdriveUrl) {
        payload.gdriveUrl = this.state.gdriveUrl;
      }

      const jobData = await generateQuizJob(payload);
      this.state.jobId = jobData.jobId;
      this.notify('job-enqueued');

      if (this.disconnectEvents) {
        this.disconnectEvents();
      }

      this.disconnectEvents = connectJobEvents(jobData.jobId, {
        onProgress: (evt) => {
          this.state.progress = Math.max(this.state.progress, Math.min(99, evt.percentage || 0));
          if (evt.stage) {
            this.state.stage = evt.stage;
          } else if (!this.state.stage) {
            this.state.stage = 'Đang xử lý tài liệu và xuất PDF...';
          }
          this.notify('job-progress');
        },
        onCompleted: (evt) => {
          this.state.isProcessing = false;
          this.state.progress = 100;
          this.state.stage = 'Hoàn tất xuất bản 2 tệp PDF A4!';

          let res = null;
          if (evt && evt.worksheet && evt.answer) {
            res = evt;
          } else if (evt && evt.result && evt.result.worksheet) {
            res = evt.result;
          } else if (evt && evt.data && evt.data.worksheet) {
            res = evt.data;
          } else if (evt && Array.isArray(evt.files)) {
            const wsF = evt.files.find(f => (f.originalName || '').includes('_DeBai') || (f.fileName || '').includes('_DeBai') || (f.fileId || '').endsWith('_ws'));
            const ansF = evt.files.find(f => (f.originalName || '').includes('_DapAn') || (f.fileName || '').includes('_DapAn') || (f.fileId || '').endsWith('_ans'));
            if (wsF && ansF) {
              const wsName = wsF.originalName || wsF.fileName || 'DeBai.pdf';
              const ansName = ansF.originalName || ansF.fileName || 'DapAn.pdf';
              const wsId = wsF.fileId || wsF.id;
              const ansId = ansF.fileId || ansF.id;
              const wsEncoded = encodeURIComponent(wsName);
              const ansEncoded = encodeURIComponent(ansName);
              res = {
                jobId: evt.jobId,
                worksheet: {
                  fileId: wsId,
                  fileName: wsName,
                  sizeBytes: wsF.sizeBytes || 0,
                  pages: 1,
                  downloadUrl: `/api/v1/files/download/${wsId}/${wsEncoded}?filename=${wsEncoded}`,
                  viewUrl: `/api/v1/files/view/${wsId}/${wsEncoded}`
                },
                answer: {
                  fileId: ansId,
                  fileName: ansName,
                  sizeBytes: ansF.sizeBytes || 0,
                  pages: 1,
                  downloadUrl: `/api/v1/files/download/${ansId}/${ansEncoded}?filename=${ansEncoded}`,
                  viewUrl: `/api/v1/files/view/${ansId}/${ansEncoded}`
                },
                questionsCount: this.state.count || 20
              };
            }
          }

          // Sync completed items to local history BEFORE notifying listeners
          if (res?.worksheet && res?.answer) {
            try {
              saveQuizHistoryPair({
                id: `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                timestamp: Date.now(),
                createdAt: new Date().toISOString(),
                prefix: this.state.prefix || 'Bài tập',
                title: this.state.title || 'Bài tập trắc nghiệm',
                count: res.questionsCount || this.state.count,
                pages: this.state.pages,
                worksheet: res.worksheet,
                answer: res.answer
              });

              storage.addHistoryItem({
                toolId: 'quiz-generator',
                toolTitle: 'Tạo Bài Tập Trắc Nghiệm',
                fileName: res.worksheet.fileName || 'DeBai.pdf',
                originalSize: res.worksheet.sizeBytes,
                resultSize: res.worksheet.sizeBytes,
                resultFileId: res.worksheet.fileId,
                downloadUrl: res.worksheet.downloadUrl || `/api/v1/files/download/${res.worksheet.fileId}`,
                status: 'success'
              });
              storage.addHistoryItem({
                toolId: 'quiz-generator',
                toolTitle: 'Tạo Bài Tập Trắc Nghiệm',
                fileName: res.answer.fileName || 'DapAn.pdf',
                originalSize: res.answer.sizeBytes,
                resultSize: res.answer.sizeBytes,
                resultFileId: res.answer.fileId,
                downloadUrl: res.answer.downloadUrl || `/api/v1/files/download/${res.answer.fileId}`,
                status: 'success'
              });
            } catch (_) {}
          }

          this.state.result = res;
          this.notify('job-completed');
          showToast('Tạo bài tập trắc nghiệm và đáp án A4 thành công!', 'success');

          // Trigger native push notification if running inside Android APK
          if (window.AndroidBridge && typeof window.AndroidBridge.showNotification === 'function') {
            try {
              const quizName = this.state.prefix || 'PDF';
              window.AndroidBridge.showNotification(
                'Tạo bài tập hoàn tất',
                `Đã tạo thành công Đề bài và Đáp án: ${quizName}`,
                'quiz'
              );
            } catch (_) {}
          }
        },
        onError: (err) => {
          this.state.isProcessing = false;
          let errorMsg = err?.message || 'Tác vụ tạo bài tập trắc nghiệm thất bại';
          const lower = errorMsg.toLowerCase();
          if (
            lower.includes('không có câu hỏi') ||
            lower.includes('không tìm thấy câu hỏi') ||
            lower.includes('no questions')
          ) {
            errorMsg = 'Không có câu hỏi trong trang, vui lòng chọn lại.';
          } else if (errorMsg.includes('Traceback (most recent call last):')) {
            const lines = errorMsg.trim().split('\n');
            const lastLine = lines[lines.length - 1].trim();
            errorMsg = lastLine.includes(':') ? lastLine.split(':').slice(1).join(':').trim() || lastLine : lastLine;
          }
          this.state.error = errorMsg;
          this.notify('job-error');
          showToast(this.state.error, 'error');

          if (window.AndroidBridge && typeof window.AndroidBridge.showNotification === 'function') {
            try {
              window.AndroidBridge.showNotification(
                'Lỗi tạo bài tập',
                this.state.error,
                'quiz_error'
              );
            } catch (_) {}
          }
        }
      });
    } catch (err) {
      this.state.isProcessing = false;
      this.state.error = err.message || 'Lỗi gửi yêu cầu tạo bài tập trắc nghiệm';
      this.notify('job-error');
      showToast(this.state.error, 'error');
    }
  }

  cancelJob() {
    if (this.disconnectEvents) {
      this.disconnectEvents();
      this.disconnectEvents = null;
    }
    this.state.isProcessing = false;
    this.notify('job-cancelled');
  }

  clearResult() {
    this.state.result = null;
    this.state.error = null;
    this.notify('result-cleared');
  }

  teardown() {
    if (this.disconnectEvents) {
      this.disconnectEvents();
      this.disconnectEvents = null;
    }
    if (this.uploadAbortController) {
      this.uploadAbortController.abort();
      this.uploadAbortController = null;
    }
  }
}

export const quizManager = new QuizManager();
