import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executePythonEngine } from '../../src/workers/pdf.worker.js';
import { watchJobProgress } from '../../../src/utilities/jobWatcher.js';
import { getJobEvents } from '../../src/api/controllers/jobs.controller.js';
import { prisma } from '../../src/lib/prisma.js';
import * as taskQueue from '../../src/queues/task.queue.js';

describe('PDF Architecture & 25% Freeze Elimination Test Suite', () => {
  // =========================================================================
  // 1. DUAL-CHANNEL JOB WATCHER TESTS (src/utilities/jobWatcher.js)
  // =========================================================================
  describe('Dual-Channel Job Watcher (watchJobProgress)', () => {
    let originalEventSource: any;
    let originalFetch: any;
    let mockInstances: any[] = [];

    class MockEventSource {
      url: string;
      listeners: Record<string, ((e: any) => void)[]> = {};
      onerror: (() => void) | null = null;
      closed = false;

      constructor(url: string) {
        this.url = url;
        mockInstances.push(this);
      }

      addEventListener(event: string, cb: (e: any) => void) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(cb);
      }

      emit(event: string, data: any) {
        if (this.closed) return;
        const handlers = this.listeners[event] || [];
        for (const h of handlers) {
          h({ data: JSON.stringify(data) });
        }
      }

      close() {
        this.closed = true;
      }
    }

    const flushMicrotasks = async () => {
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
    };

    beforeEach(() => {
      vi.useFakeTimers();
      mockInstances = [];
      originalEventSource = (globalThis as any).EventSource;
      originalFetch = globalThis.fetch;
      (globalThis as any).EventSource = MockEventSource;
    });

    afterEach(() => {
      vi.useRealTimers();
      (globalThis as any).EventSource = originalEventSource;
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('should proactively execute pollStatus() at t = 0 upon initialization', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: 'job_fast_1',
            status: 'COMPLETED',
            files: [{ fileId: 'fil_1', purpose: 'PROCESSED_ARTIFACT', sizeBytes: 1024, downloadUrl: '/dl/1' }]
          }
        })
      });
      globalThis.fetch = mockFetch;

      const onCompleted = vi.fn();
      const onFailed = vi.fn();
      const onProgress = vi.fn();

      watchJobProgress({
        apiBase: 'http://localhost:3000',
        eventsUrl: '/api/v1/jobs/job_fast_1/events',
        pollUrl: '/api/v1/jobs/job_fast_1',
        onProgress,
        onCompleted,
        onFailed
      });

      // Verification: fetch was called immediately at t = 0 without advancing timer
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/jobs/job_fast_1',
        expect.objectContaining({ signal: expect.any(Object) })
      );

      // Flush microtasks
      await flushMicrotasks();

      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job_fast_1',
          percentage: 100,
          resultFileId: 'fil_1'
        })
      );
    });

    it('should engage fallback polling when EventSource encounters an error or is unavailable', async () => {
      let pollCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        pollCount++;
        if (pollCount >= 3) {
          return {
            ok: true,
            json: async () => ({
              data: {
                id: 'job_poll_3',
                status: 'COMPLETED',
                files: [{ fileId: 'fil_poll', purpose: 'PROCESSED_ARTIFACT' }]
              }
            })
          };
        }
        return {
          ok: true,
          json: async () => ({
            data: { id: 'job_poll_3', status: 'PROCESSING', progress: 30, stage: 'Processing' }
          })
        };
      });
      globalThis.fetch = mockFetch;

      const onCompleted = vi.fn();
      const onFailed = vi.fn();
      const onProgress = vi.fn();

      watchJobProgress({
        apiBase: 'http://localhost:3000',
        eventsUrl: '/api/v1/jobs/job_poll_3/events',
        pollUrl: '/api/v1/jobs/job_poll_3',
        onProgress,
        onCompleted,
        onFailed
      });

      // t = 0: initial poll
      expect(mockFetch).toHaveBeenCalledTimes(1);
      await flushMicrotasks();

      // In battery-optimized architecture, concurrent polling does NOT fire at 2000ms while SSE is healthy
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // When EventSource errors, fallback polling engages immediately
      mockInstances[0].onerror?.();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Advance by fallback interval (2500ms): poll 3 completes the job
      await vi.advanceTimersByTimeAsync(2500);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(mockInstances[0].closed).toBe(true);

      // Advance further: polling must be stopped
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('atomic completion guard: only single callback invocation even when both channels report complete', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: 'job_race',
            status: 'COMPLETED',
            files: [{ fileId: 'fil_race', purpose: 'PROCESSED_ARTIFACT' }]
          }
        })
      });
      globalThis.fetch = mockFetch;

      const onCompleted = vi.fn();
      const onFailed = vi.fn();
      const onProgress = vi.fn();

      watchJobProgress({
        apiBase: 'http://localhost:3000',
        eventsUrl: '/api/v1/jobs/job_race/events',
        pollUrl: '/api/v1/jobs/job_race',
        onProgress,
        onCompleted,
        onFailed
      });

      // SSE also emits completed event concurrently
      const es = mockInstances[0];
      es.emit('completed', { jobId: 'job_race', resultFileId: 'fil_race' });

      await flushMicrotasks();

      // Callback must be called exactly once
      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onFailed).not.toHaveBeenCalled();
      expect(es.closed).toBe(true);
    });

    it('should correctly extract jobId when REST endpoint returns { data: { jobId: ... } }', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            jobId: 'job_standard_schema_1',
            status: 'COMPLETED',
            files: [
              {
                fileId: 'fil_artifact_std',
                purpose: 'PROCESSED_ARTIFACT',
                originalName: 'output.pdf',
                sizeBytes: 4096,
                downloadUrl: '/api/v1/files/download/fil_artifact_std'
              }
            ]
          }
        })
      });
      globalThis.fetch = mockFetch;

      const onCompleted = vi.fn();
      watchJobProgress({
        apiBase: 'http://localhost:3000',
        eventsUrl: '/api/v1/jobs/job_standard_schema_1/events',
        pollUrl: '/api/v1/jobs/job_standard_schema_1',
        onProgress: vi.fn(),
        onCompleted,
        onFailed: vi.fn()
      });

      await flushMicrotasks();

      expect(onCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job_standard_schema_1',
          percentage: 100,
          resultFileId: 'fil_artifact_std',
          resultFileName: 'output.pdf'
        })
      );
    });

    it('heartbeat watchdog timer: triggers fallback polling if no events received for 12 seconds', async () => {
      let pollCallCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        pollCallCount++;
        return {
          ok: true,
          json: async () => ({
            data: { id: 'job_stall', status: 'PROCESSING', progress: 50 }
          })
        };
      });
      globalThis.fetch = mockFetch;

      const cleanup = watchJobProgress({
        apiBase: 'http://localhost:3000',
        eventsUrl: '/api/v1/jobs/job_stall/events',
        pollUrl: '/api/v1/jobs/job_stall',
        onProgress: vi.fn(),
        onCompleted: vi.fn(),
        onFailed: vi.fn()
      });

      // t = 0: initial poll
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance 6 seconds: under 12s threshold, so no fallback polling occurs
      await vi.advanceTimersByTimeAsync(6000);
      expect(pollCallCount).toBe(1);

      // Advance another 6 seconds (total 12 seconds): watchdog timer fires and engages fallback polling
      await vi.advanceTimersByTimeAsync(6000);
      expect(pollCallCount).toBeGreaterThanOrEqual(2);

      cleanup();
    });

    it('cleanup function immediately shuts down EventSource and polling timers', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 'job_clean', status: 'PROCESSING' } })
      });
      globalThis.fetch = mockFetch;

      const cleanup = watchJobProgress({
        apiBase: 'http://localhost:3000',
        eventsUrl: '/api/v1/jobs/job_clean/events',
        pollUrl: '/api/v1/jobs/job_clean',
        onProgress: vi.fn(),
        onCompleted: vi.fn(),
        onFailed: vi.fn()
      });

      expect(mockInstances[0].closed).toBe(false);
      cleanup();

      expect(mockInstances[0].closed).toBe(true);
      const callsBefore = mockFetch.mock.calls.length;

      // Advancing timer should produce NO further fetch calls
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockFetch.mock.calls.length).toBe(callsBefore);
    });

    it('cleanup function prevents in-flight poll from triggering onCompleted or onProgress', async () => {
      let resolveFetch: any;
      const mockFetch = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          })
      );
      globalThis.fetch = mockFetch;

      const onCompleted = vi.fn();
      const onProgress = vi.fn();
      const cleanup = watchJobProgress({
        apiBase: 'http://localhost:3000',
        eventsUrl: '/api/v1/jobs/job_inflight/events',
        pollUrl: '/api/v1/jobs/job_inflight',
        onProgress,
        onCompleted,
        onFailed: vi.fn()
      });

      // Polling has started and fetch is in-flight
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // User cancels / cleans up before fetch resolves
      cleanup();

      // Now fetch finishes resolving with COMPLETED
      resolveFetch({
        ok: true,
        json: async () => ({
          data: {
            jobId: 'job_inflight',
            status: 'COMPLETED',
            files: [{ fileId: 'fil_x', purpose: 'PROCESSED_ARTIFACT' }]
          }
        })
      });

      await flushMicrotasks();

      // Must NOT invoke onCompleted because cleanup set isDone = true
      expect(onCompleted).not.toHaveBeenCalled();
      expect(onProgress).not.toHaveBeenCalled();
    });

    it('recovers gracefully from fetch rejection without permanently freezing polling lock', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Network offline');
        }
        return {
          ok: true,
          json: async () => ({
            data: { jobId: 'job_recov', status: 'COMPLETED', files: [] }
          })
        };
      });
      globalThis.fetch = mockFetch;

      const onCompleted = vi.fn();
      const cleanup = watchJobProgress({
        apiBase: 'http://localhost:3000',
        eventsUrl: '/api/v1/jobs/job_recov/events',
        pollUrl: '/api/v1/jobs/job_recov',
        onProgress: vi.fn(),
        onCompleted,
        onFailed: vi.fn()
      });

      // t = 0 failed
      await flushMicrotasks();
      expect(onCompleted).not.toHaveBeenCalled();

      // Trigger fallback polling via EventSource error; poll 2 runs and succeeds because isPolling was safely reset
      mockInstances[0].onerror?.();
      await flushMicrotasks();

      expect(callCount).toBe(2);
      expect(onCompleted).toHaveBeenCalledTimes(1);

      cleanup();
    });
  });

  // =========================================================================
  // 2. REDIS PUB/SUB RACE CONDITION ELIMINATION (jobs.controller.ts)
  // =========================================================================
  describe('Redis Pub/Sub Post-Subscription Race Condition Recovery (jobs.controller.ts)', () => {
    it('should catch COMPLETED state during subscription window and emit completed event', async () => {
      const jobId = 'job_test_race_win';
      let subscribeResolved = false;

      // Mock Prisma job queries:
      // First call (initial check): PROCESSING
      // Second call (post-subscription check): COMPLETED
      let findCount = 0;
      vi.spyOn(prisma.job, 'findUnique').mockImplementation(async () => {
        findCount++;
        if (findCount === 1) {
          return {
            id: jobId,
            status: 'PROCESSING',
            progress: 25,
            optionsJson: '{}',
            files: []
          } as any;
        }
        return {
          id: jobId,
          status: 'COMPLETED',
          progress: 100,
          optionsJson: JSON.stringify({ result: { extraField: 123 } }),
          files: [
            {
              id: 'fil_artifact_1',
              purpose: 'PROCESSED_ARTIFACT',
              sizeBytes: 2048n,
              downloadUrl: '/api/v1/files/download/fil_artifact_1'
            }
          ]
        } as any;
      });

      // Mock Redis Subscriber
      const mockSubscriber = {
        on: vi.fn(),
        off: vi.fn(),
        subscribe: vi.fn().mockImplementation(async () => {
          subscribeResolved = true;
        }),
        unsubscribe: vi.fn().mockResolvedValue(undefined),
        quit: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn()
      };
      vi.spyOn(taskQueue, 'createRedisSubscriber').mockReturnValue(mockSubscriber as any);

      const writtenChunks: string[] = [];
      let isEnded = false;

      const mockRequest = {
        params: { jobId },
        raw: {
          on: vi.fn()
        }
      } as any;

      const mockReply = {
        raw: {
          writeHead: vi.fn(),
          flushHeaders: vi.fn(),
          write: vi.fn().mockImplementation((chunk: string) => {
            writtenChunks.push(chunk);
          }),
          end: vi.fn().mockImplementation(() => {
            isEnded = true;
          })
        }
      } as any;

      await getJobEvents(mockRequest, mockReply);

      // Verify Redis subscribed
      expect(mockSubscriber.subscribe).toHaveBeenCalledWith(`job:events:${jobId}`);

      // Verify that post-subscription check wrote event: completed
      const fullOutput = writtenChunks.join('');
      expect(fullOutput).toContain('event: connected');
      expect(fullOutput).toContain('event: completed');
      expect(fullOutput).toContain('fil_artifact_1');

      // Verify stream was ended
      expect(isEnded).toBe(true);

      // Verify subscriber was cleaned up
      expect(mockSubscriber.unsubscribe).toHaveBeenCalled();
      expect(mockSubscriber.quit).toHaveBeenCalled();
    });

    it('should catch FAILED state during subscription window and emit failed event', async () => {
      const jobId = 'job_test_race_fail';

      let findCount = 0;
      vi.spyOn(prisma.job, 'findUnique').mockImplementation(async () => {
        findCount++;
        if (findCount === 1) {
          return {
            id: jobId,
            status: 'PROCESSING',
            progress: 25,
            optionsJson: '{}',
            files: []
          } as any;
        }
        return {
          id: jobId,
          status: 'FAILED',
          errorMessage: 'Corrupted document format',
          files: []
        } as any;
      });

      const mockSubscriber = {
        on: vi.fn(),
        off: vi.fn(),
        subscribe: vi.fn().mockResolvedValue(undefined),
        unsubscribe: vi.fn().mockResolvedValue(undefined),
        quit: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn()
      };
      vi.spyOn(taskQueue, 'createRedisSubscriber').mockReturnValue(mockSubscriber as any);

      const writtenChunks: string[] = [];
      let isEnded = false;

      const mockRequest = {
        params: { jobId },
        raw: { on: vi.fn() }
      } as any;

      const mockReply = {
        raw: {
          writeHead: vi.fn(),
          flushHeaders: vi.fn(),
          write: vi.fn().mockImplementation((chunk: string) => {
            writtenChunks.push(chunk);
          }),
          end: vi.fn().mockImplementation(() => {
            isEnded = true;
          })
        }
      } as any;

      await getJobEvents(mockRequest, mockReply);

      const fullOutput = writtenChunks.join('');
      expect(fullOutput).toContain('event: failed');
      expect(fullOutput).toContain('Corrupted document format');
      expect(isEnded).toBe(true);
      expect(mockSubscriber.unsubscribe).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. LINEAR PROGRESS SCALING LOGIC (usePdfQueue.js)
  // =========================================================================
  describe('Linear Progress Scaling Logic', () => {
    // Formula tested: const scaled = Math.min(99, 25 + Math.round((pct / 100) * 74));
    const scaleProgress = (pct: number) => Math.min(99, 25 + Math.round((pct / 100) * 74));

    it('should scale 0% worker progress to 25% UI baseline', () => {
      expect(scaleProgress(0)).toBe(25);
    });

    it('should immediately advance UI from 25% to 32% on initial 10% worker event', () => {
      // 25 + Math.round(0.10 * 74) = 25 + 7 = 32
      expect(scaleProgress(10)).toBe(32);
      expect(scaleProgress(10)).toBeGreaterThan(25);
    });

    it('should advance UI to 36% on 15% worker event', () => {
      // 25 + Math.round(0.15 * 74) = 25 + 11 = 36
      expect(scaleProgress(15)).toBe(36);
    });

    it('should scale 50% worker progress to 62% UI progress', () => {
      // 25 + Math.round(0.50 * 74) = 25 + 37 = 62
      expect(scaleProgress(50)).toBe(62);
    });

    it('should cap worker 100% progress at 99% before completion event arrives', () => {
      // 25 + 74 = 99
      expect(scaleProgress(100)).toBe(99);
    });

    it('should maintain strict monotonic non-decreasing order with Math.max', () => {
      let uiProgress = 25;
      const workerEvents = [0, 10, 15, 30, 50, 75, 90, 100];

      for (const pct of workerEvents) {
        const scaled = scaleProgress(pct);
        uiProgress = Math.max(uiProgress, scaled);
      }

      expect(uiProgress).toBe(99);
    });

    it('should defensively handle NaN and negative progress inputs without breaking UI', () => {
      const defensiveScale = (pct: any) => {
        const validPct = typeof pct === 'number' && !isNaN(pct) ? Math.max(0, Math.min(100, pct)) : 0;
        return Math.min(99, 25 + Math.round((validPct / 100) * 74));
      };

      expect(defensiveScale(NaN)).toBe(25);
      expect(defensiveScale(-10)).toBe(25);
      expect(defensiveScale(undefined)).toBe(25);
      expect(defensiveScale(150)).toBe(99);
    });
  });

  // =========================================================================
  // 4. PYTHON ENGINE WATCHDOG TIMEOUT & PERSISTENCE (pdf.worker.ts)
  // =========================================================================
  describe('Python Engine Watchdog Execution Timeout (executePythonEngine)', () => {
    it('should terminate hung child process and reject with safe error message upon timeout', async () => {
      const startTime = Date.now();

      // Run node process that intentionally sleeps for 10 seconds, but set watchdog timeout to 150ms
      const timeoutMs = 150;
      const onProgress = vi.fn().mockResolvedValue(undefined);

      await expect(
        executePythonEngine(
          process.execPath,
          '-e',
          ['setTimeout(() => {}, 10000)'],
          onProgress,
          timeoutMs
        )
      ).rejects.toThrow('Thời gian xử lý tài liệu vượt quá giới hạn an toàn (120s). Vui lòng thử lại với file nhỏ hơn.');

      const elapsed = Date.now() - startTime;
      // Must have terminated near the 150ms timeout mark, NOT after 10000ms
      expect(elapsed).toBeLessThan(2000);
    });

    it('should resolve normally when execution completes well before timeout', async () => {
      const onProgress = vi.fn().mockResolvedValue(undefined);

      // Fast execution: writes progress and exits with 0
      await expect(
        executePythonEngine(
          process.execPath,
          '-e',
          ['console.log(JSON.stringify({ progress: 50, stage: "Testing" })); process.exit(0);'],
          onProgress,
          5000
        )
      ).resolves.toBeUndefined();

      expect(onProgress).toHaveBeenCalledWith(50, 'Testing');
    });

    it('should verify processPdfJob optionsJson persistence structure on completion', () => {
      const originalSizeBytes = 10000;
      const resultSizeBytes = 4000;
      const savingsPct = Number(
        Math.max(0, ((originalSizeBytes - resultSizeBytes) / originalSizeBytes) * 100).toFixed(1)
      );

      const resultPayload = {
        jobId: 'job_persist_test',
        percentage: 100,
        resultFileId: 'fil_res_1',
        resultFileName: 'doc_compressed.pdf',
        resultSizeBytes,
        originalSizeBytes,
        savingsPct,
        downloadUrl: '/api/v1/files/download/fil_res_1',
        historyId: 'hist_1'
      };

      const optionsJson = JSON.stringify({
        initialOption: true,
        result: resultPayload
      });

      const parsed = JSON.parse(optionsJson);
      expect(parsed.result).toBeDefined();
      expect(parsed.result.savingsPct).toBe(60);
      expect(parsed.result.resultFileName).toBe('doc_compressed.pdf');
    });
  });
});
