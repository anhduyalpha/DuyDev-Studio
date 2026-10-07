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
  let activePollAbort = null;

  const onVisibilityChange = () => {
    if (isDone) return;
    if (typeof document !== 'undefined' && !document.hidden) {
      pollStatus();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  const cleanup = () => {
    isDone = true;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    if (activePollAbort) {
      try {
        activePollAbort.abort();
      } catch {}
      activePollAbort = null;
    }
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
    cleanup();
    onCompleted(data);
  };

  const finishError = (errMessage) => {
    if (isDone) return;
    cleanup();
    onFailed(errMessage);
  };

  const pollStatus = async () => {
    if (isDone || isPolling) return;
    isPolling = true;

    const controller = new AbortController();
    activePollAbort = controller;
    const fetchTimeout = setTimeout(() => {
      try {
        controller.abort();
      } catch {}
    }, 6000);

    try {
      const fullPollUrl = pollUrl.startsWith('http') ? pollUrl : `${apiBase}${pollUrl}`;
      const res = await fetch(fullPollUrl, { signal: controller.signal });
      clearTimeout(fetchTimeout);

      if (!res.ok) return;
      const resJson = await res.json();
      const job = resJson?.data;
      if (!job || isDone) return;

      lastActivityTime = Date.now();

      if (job.status === 'COMPLETED') {
        const fileObj = job.files?.find((f) => f.purpose === 'PROCESSED_ARTIFACT') || job.files?.[0];
        const inputFile = job.files?.find((f) => f.purpose !== 'PROCESSED_ARTIFACT');
        const resolvedFileId = fileObj?.fileId || fileObj?.id || null;
        finishSuccess({
          jobId: job.jobId || job.id,
          percentage: 100,
          resultFileId: resolvedFileId,
          resultFileName: fileObj?.originalName || null,
          resultSizeBytes: fileObj?.sizeBytes,
          originalSizeBytes: inputFile?.sizeBytes || null,
          downloadUrl: fileObj?.downloadUrl || (resolvedFileId ? `/api/v1/files/download/${resolvedFileId}` : null),
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
      clearTimeout(fetchTimeout);
      if (activePollAbort === controller) {
        activePollAbort = null;
      }
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
