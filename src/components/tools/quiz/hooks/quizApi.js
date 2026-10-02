/**
 * Quiz API Client (< 160 lines)
 * Handles file upload, intent parsing, job submission, and SSE event streaming.
 */

import { smartUploadFile } from '../../../../utilities/resumableUploader.js';

export async function uploadQuizFile(file, options = {}) {
  return await smartUploadFile(file, {
    purpose: 'quiz-generator',
    onProgress: options.onProgress,
    onStage: options.onStage,
    signal: options.signal
  });
}

export async function parsePromptApi(prompt) {
  const res = await fetch('/api/v1/quiz/parse-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Không thể phân tích prompt');
  }

  const json = await res.json();
  return json.data;
}

export async function generateQuizJob(payload) {
  const res = await fetch('/api/v1/quiz/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Không thể khởi tạo tiến trình tạo bài tập trắc nghiệm');
  }

  const json = await res.json();
  return json.data;
}

export function connectJobEvents(jobId, { onProgress, onCompleted, onError }) {
  const url = `/api/v1/jobs/${jobId}/events`;
  const eventSource = new EventSource(url);
  let isClosed = false;

  const teardown = () => {
    if (isClosed) return;
    isClosed = true;
    clearInterval(pollTimer);
    try { eventSource.close(); } catch (_) {}
  };

  eventSource.addEventListener('progress', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (typeof onProgress === 'function') {
        onProgress(data);
      }
    } catch (_) {}
  });

  eventSource.addEventListener('completed', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (typeof onCompleted === 'function') {
        onCompleted(data);
      }
    } catch (_) {}
    teardown();
  });

  eventSource.addEventListener('failed', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (typeof onError === 'function') {
        onError(new Error(data.error || 'Tác vụ thất bại'));
      }
    } catch (_) {
      if (typeof onError === 'function') onError(new Error('Tác vụ thất bại'));
    }
    teardown();
  });

  eventSource.onerror = () => {
    // If stream encounters error or closes, do not immediately fail; let polling fallback take over
  };

  // Fallback Polling every 2.5s for resilient mobile/proxy updates
  const pollTimer = setInterval(async () => {
    if (isClosed) return;
    try {
      const res = await fetch(`/api/v1/jobs/${jobId}`);
      if (!res.ok) return;
      const json = await res.json();
      const job = json.data;
      if (!job) return;

      if (job.status === 'PROCESSING') {
        if (typeof onProgress === 'function' && job.progress !== undefined) {
          onProgress({ percentage: job.progress, stage: job.stage });
        }
      } else if (job.status === 'COMPLETED') {
        teardown();
        if (typeof onCompleted === 'function') {
          onCompleted(job);
        }
      } else if (job.status === 'FAILED') {
        teardown();
        if (typeof onError === 'function') {
          onError(new Error(job.errorMessage || 'Tác vụ thất bại'));
        }
      }
    } catch (_) {}
  }, 2500);

  return teardown;
}
