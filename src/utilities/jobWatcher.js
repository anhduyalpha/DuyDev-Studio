/**
 * Real-time SSE and Polling Job Watcher Utility (< 100 lines)
 */

export function watchJobProgress({
  apiBase,
  eventsUrl,
  pollUrl,
  onProgress,
  onCompleted,
  onFailed
}) {
  let isDone = false;
  let pollTimer = null;
  let activeEventSource = null;

  const cleanup = () => {
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const finishSuccess = (data) => {
    if (isDone) return;
    isDone = true;
    cleanup();
    onCompleted(data);
  };

  const finishError = (errMessage) => {
    if (isDone) return;
    isDone = true;
    cleanup();
    onFailed(errMessage);
  };

  const pollStatus = async () => {
    if (isDone) return;
    try {
      const fullPollUrl = pollUrl.startsWith('http') ? pollUrl : `${apiBase}${pollUrl}`;
      const res = await fetch(fullPollUrl);
      if (!res.ok) return;
      const resJson = await res.json();
      const job = resJson.data;

      if (job.status === 'COMPLETED') {
        const fileObj = job.files?.find((f) => f.purpose === 'PROCESSED_ARTIFACT') || job.files?.[0];
        finishSuccess({
          resultFileId: fileObj?.fileId,
          resultSizeBytes: fileObj?.sizeBytes,
          downloadUrl: fileObj?.downloadUrl
        });
      } else if (job.status === 'FAILED') {
        finishError(job.errorMessage || 'Tác vụ thất bại');
      } else if (job.progress) {
        onProgress(job.progress, job.stage);
      }
    } catch {}
  };

  const fullEventsUrl = eventsUrl.startsWith('http') ? eventsUrl : `${apiBase}${eventsUrl}`;
  const es = new EventSource(fullEventsUrl);
  activeEventSource = es;

  es.addEventListener('progress', (e) => {
    try {
      const data = JSON.parse(e.data);
      onProgress(data.percentage || 0, data.stage);
    } catch {}
  });

  es.addEventListener('completed', (e) => {
    try {
      const data = JSON.parse(e.data);
      finishSuccess(data);
    } catch {
      pollStatus();
    }
  });

  es.addEventListener('failed', (e) => {
    try {
      const data = JSON.parse(e.data);
      finishError(data.error || 'Tác vụ thất bại');
    } catch {
      finishError('Tác vụ xử lý thất bại');
    }
  });

  es.onerror = () => {
    if (!isDone && !pollTimer) {
      pollTimer = setInterval(pollStatus, 1500);
    }
  };

  return cleanup;
}
