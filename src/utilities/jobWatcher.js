/**
 * Real-time SSE and Polling Job Watcher Utility (< 130 lines)
 * Resilient Dual-Channel Watcher: SSE streaming + concurrent active polling safety net
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
  let watchdogTimer = null;
  let activeEventSource = null;
  let lastActivityTime = Date.now();
  let isPolling = false;

  const cleanup = () => {
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
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
    if (isDone || isPolling) return;
    isPolling = true;
    try {
      const fullPollUrl = pollUrl.startsWith('http') ? pollUrl : `${apiBase}${pollUrl}`;
      const res = await fetch(fullPollUrl);
      if (!res.ok) return;
      const resJson = await res.json();
      const job = resJson?.data;
      if (!job || isDone) return;

      lastActivityTime = Date.now();

      if (job.status === 'COMPLETED') {
        const fileObj = job.files?.find((f) => f.purpose === 'PROCESSED_ARTIFACT') || job.files?.[0];
        finishSuccess({
          jobId: job.id,
          percentage: 100,
          resultFileId: fileObj?.fileId,
          resultSizeBytes: fileObj?.sizeBytes,
          downloadUrl: fileObj?.downloadUrl,
          ...(job.result && typeof job.result === 'object' ? job.result : {})
        });
      } else if (job.status === 'FAILED') {
        finishError(job.errorMessage || 'Tác vụ thất bại');
      } else if (job.progress !== undefined && job.progress !== null) {
        onProgress(job.progress, job.stage);
      }
    } catch {
      // Network or parse issue; concurrent polling will retry
    } finally {
      isPolling = false;
    }
  };

  // 1. Proactive status check at t = 0 (immediately catches jobs completed < 200ms)
  pollStatus();

  // 2. Active concurrent polling safety net running alongside EventSource
  pollTimer = setInterval(pollStatus, 2000);

  // 3. Heartbeat watchdog timer: if no progress/event received for 12 seconds, perform immediate poll
  watchdogTimer = setInterval(() => {
    if (isDone) return;
    if (Date.now() - lastActivityTime >= 12000) {
      pollStatus();
    }
  }, 3000);

  // 4. SSE Real-time streaming channel
  try {
    const fullEventsUrl = eventsUrl.startsWith('http') ? eventsUrl : `${apiBase}${eventsUrl}`;
    const es = new EventSource(fullEventsUrl);
    activeEventSource = es;

    es.addEventListener('progress', (e) => {
      lastActivityTime = Date.now();
      try {
        const data = JSON.parse(e.data);
        onProgress(data.percentage || 0, data.stage);
      } catch {}
    });

    es.addEventListener('completed', (e) => {
      lastActivityTime = Date.now();
      try {
        const data = JSON.parse(e.data);
        finishSuccess(data);
      } catch {
        pollStatus();
      }
    });

    es.addEventListener('failed', (e) => {
      lastActivityTime = Date.now();
      try {
        const data = JSON.parse(e.data);
        finishError(data.error || 'Tác vụ thất bại');
      } catch {
        finishError('Tác vụ xử lý thất bại');
      }
    });

    es.onerror = () => {
      if (!isDone) {
        pollStatus();
      }
    };
  } catch {
    // If EventSource is unsupported or threw on instantiation, pollTimer continues as fallback
  }

  return cleanup;
}
