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
    throw new Error(errData.message || 'Không thể khởi tạo tiến trình tạo bài tập');
  }

  const json = await res.json();
  return json.data;
}

export function connectJobEvents(jobId, { onProgress, onCompleted, onError }) {
  const url = `/api/v1/jobs/${jobId}/events`;
  const eventSource = new EventSource(url);

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
    eventSource.close();
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
    eventSource.close();
  });

  eventSource.onerror = () => {
    // If stream fails unexpectedly
    if (eventSource.readyState === EventSource.CLOSED) {
      if (typeof onError === 'function') {
        onError(new Error('Mất kết nối theo dõi tiến trình'));
      }
    }
  };

  return () => {
    eventSource.close();
  };
}
